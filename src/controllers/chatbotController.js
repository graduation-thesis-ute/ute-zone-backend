import { Client } from "langsmith";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { MongoClient } from "mongodb";
import "dotenv/config.js";
import ChatbotTopQuestion from "../models/chatbotTopQuestionModel.js";
import ProcessedRun from "../models/processedRunModel.js";
import ChatbotMemory from "../models/chatbotMemoryModel.js";
import ChatbotConversation from "../models/chatbotConversationModel.js";

/**
 * Khởi tạo kết nối MongoDB
 * Sử dụng để kết nối đến database và thực hiện các thao tác với vector search
 */
const client = new MongoClient(process.env.MONGODB_URI);

/**
 * Cấu hình LangSmith tracing
 * LangSmith được sử dụng để theo dõi và phân tích các cuộc hội thoại của chatbot
 * Chỉ bật tracing khi biến môi trường LANGSMITH_TRACING được set là "true"
 */
const isTracingEnabled = process.env.LANGSMITH_TRACING === "true";
const langsmithClient = isTracingEnabled
  ? new Client({
      apiUrl: process.env.LANGSMITH_ENDPOINT,
      apiKey: process.env.LANGSMITH_API_KEY,
    })
  : null;

/**
 * Cache để tránh duplicate runs trong LangSmith
 * Lưu trữ tạm thời các run ID để tránh việc tạo nhiều run trùng lặp
 */
const runCache = new Map();

/**
 * Khởi tạo model GPT-4 cho chatbot
 * Cấu hình:
 * - model: gpt-4o-mini - phiên bản nhẹ của GPT-4
 * - temperature: 0 - để có câu trả lời ổn định và nhất quán
 * - callbacks: Các hàm callback để theo dõi quá trình xử lý của model
 */
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  ...(isTracingEnabled && {
    callbacks: [
      {
        /**
         * Xử lý khi bắt đầu một LLM run
         * Tạo một run mới trong LangSmith và lưu ID vào cache
         */
        handleLLMStart: async (llm, prompts) => {
          if (!langsmithClient) return;

          try {
            const runKey = `${Date.now()}-${Math.random()}`;
            const run = await langsmithClient.createRun({
              name: "openai_chat",
              run_type: "llm",
              inputs: { prompts },
              metadata: {
                model_name: llm.modelName,
                temperature: llm.temperature,
                operation: "chat_completion",
                run_key: runKey,
              },
              project_name: "utezone",
            });

            if (run && run.id) {
              runCache.set(runKey, run.id);
              return runKey;
            }
          } catch (error) {
            console.error("Error creating langsmith run for OpenAI:", error);
          }
        },
        /**
         * Xử lý khi kết thúc một LLM run
         * Cập nhật thông tin run trong LangSmith và xóa khỏi cache
         */
        handleLLMEnd: async (output, runKey) => {
          if (!langsmithClient || !runKey) return;

          const runId = runCache.get(runKey);
          if (!runId) return;

          try {
            await langsmithClient.updateRun(runId, {
              outputs: {
                generations: output.generations,
                llmOutput: output.llmOutput,
              },
              end_time: new Date().toISOString(),
            });
            runCache.delete(runKey);
          } catch (error) {
            console.error("Error updating langsmith run for OpenAI:", error);
            if (error.message?.includes("Conflict")) {
              runCache.delete(runKey);
            }
          }
        },
        /**
         * Xử lý khi có lỗi trong LLM run
         * Cập nhật thông tin lỗi trong LangSmith và xóa khỏi cache
         */
        handleLLMError: async (error, runKey) => {
          if (!langsmithClient || !runKey) return;

          const runId = runCache.get(runKey);
          if (!runId) return;

          try {
            await langsmithClient.updateRun(runId, {
              error: error.message,
              metadata: {
                error_type: error.name,
                status: "error",
              },
              end_time: new Date().toISOString(),
            });
          } catch (updateError) {
            console.error(
              "Error updating langsmith run for OpenAI error:",
              updateError
            );
          } finally {
            runCache.delete(runKey);
          }
        },
      },
    ],
  }),
});

/**
 * Khởi tạo model embedding tiếng Việt
 * Sử dụng model "bkai-foundation-models/vietnamese-bi-encoder" để tạo vector embedding
 * cho các câu hỏi và tài liệu tiếng Việt
 */
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "bkai-foundation-models/vietnamese-bi-encoder",
  dtype: "fp32",
});

/**
 * Tìm kiếm tài liệu tương tự dựa trên câu hỏi
 * Sử dụng vector search trong MongoDB để tìm các tài liệu có nội dung tương tự với câu hỏi
 *
 * @param {string} query - Câu hỏi cần tìm kiếm
 * @param {string} parentRunId - ID của run cha trong LangSmith (nếu có)
 * @returns {Array} Danh sách các tài liệu tương tự, mỗi tài liệu chứa content và score
 */
async function searchSimilarDocuments(query, parentRunId) {
  const collection = client
    .db(process.env.DB_NAME)
    .collection(process.env.DB_COLLECTION_VECTOR_SEARCH);

  const vector = await embeddings.embedQuery(query);

  const results = await collection
    .aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: vector,
          numCandidates: 100,
          limit: 5,
        },
      },
      {
        $project: {
          content: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();

  if (parentRunId) {
    try {
      await langsmithClient.updateRun(parentRunId, {
        outputs: {
          documents_found: results.length,
        },
        metadata: {
          status: "success",
        },
        end_time: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating langsmith run for document search:", error);
    }
  }

  return results;
}

/**
 * Lưu tin nhắn vào lịch sử hội thoại
 * Lưu cả câu hỏi của người dùng và câu trả lời của chatbot vào database
 *
 * @param {string} userId - ID người dùng
 * @param {string} conversationId - ID cuộc hội thoại
 * @param {string} question - Câu hỏi của người dùng
 * @param {string} answer - Câu trả lời của chatbot
 */
async function saveMessage(userId, conversationId, question, answer) {
  await ChatbotConversation.updateOne(
    { userId, conversationId },
    {
      $push: {
        messages: {
          $each: [
            { role: "user", content: question, timestamp: new Date() },
            { role: "assistant", content: answer, timestamp: new Date() },
          ],
        },
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
}

/**
 * Tìm kiếm ký ức tương tự từ lịch sử hội thoại
 * Sử dụng vector search để tìm các ký ức (memories) có nội dung tương tự với câu hỏi
 * Chỉ tìm trong phạm vi của một người dùng và một cuộc hội thoại cụ thể
 *
 * @param {string} query - Câu hỏi cần tìm kiếm
 * @param {string} userId - ID người dùng
 * @param {string} conversationId - ID cuộc hội thoại
 * @param {string} parentRunId - ID của run cha trong LangSmith (nếu có)
 * @returns {Array} Danh sách các ký ức tương tự, mỗi ký ức chứa content và score
 */
async function searchSimilarMemories(
  query,
  userId,
  conversationId,
  parentRunId
) {
  const collection = client
    .db(process.env.DB_NAME)
    .collection(process.env.DB_COLLECTION_MEMORY_SEARCH);
  const vector = await embeddings.embedQuery(query);

  const results = await collection
    .aggregate([
      {
        $vectorSearch: {
          index: "vector_index_memories",
          path: "embedding",
          queryVector: vector,
          numCandidates: 100,
          limit: 5,
        },
      },
      {
        $match: { userId, conversationId },
      },
      {
        $project: {
          content: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();

  if (parentRunId) {
    try {
      await langsmithClient.updateRun(parentRunId, {
        outputs: {
          memories_found: results.length,
        },
        metadata: {
          status: "success",
        },
        end_time: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating langsmith run for memory search:", error);
    }
  }

  return results;
}

/**
 * Tóm tắt nội dung hội thoại bằng AI
 * Sử dụng GPT-4 để tóm tắt một đoạn hội thoại thành một câu ngắn gọn
 *
 * @param {string} content - Nội dung cần tóm tắt
 * @returns {string} Nội dung đã được tóm tắt
 */
async function summarizeContent(content) {
  console.log("Tóm tắt nội dung:", content);
  const systemMessage = new SystemMessage({
    content:
      "Bạn là một trợ lý tóm tắt. Hãy tóm tắt đoạn hội thoại sau thành một câu ngắn gọn bao gồm thông tin câu hỏi và câu trả lời, tập trung vào thông tin quan trọng nhất. Chỉ trả về bản tóm tắt, không thêm giải thích.",
  });

  const humanMessage = new HumanMessage({
    content: content,
  });

  const response = await model.invoke([systemMessage, humanMessage]);
  return response.content;
}

/**
 * Lưu ký ức vào bộ nhớ của chatbot
 * Tóm tắt nội dung hội thoại và lưu vào database với vector embedding
 *
 * @param {string} userId - ID người dùng
 * @param {string} conversationId - ID cuộc hội thoại
 * @param {string} content - Nội dung cần lưu
 */
async function saveMemory(userId, conversationId, content) {
  const summarizedContent = await summarizeContent(content);
  const embedding = await embeddings.embedQuery(summarizedContent);

  await ChatbotMemory.create({
    userId,
    conversationId,
    content: summarizedContent,
    embedding,
    timestamp: new Date(),
  });
}

/**
 * Hàm chính để xử lý câu hỏi và trả về câu trả lời
 * Quy trình xử lý:
 * 1. Tạo run trong LangSmith để theo dõi
 * 2. Tìm kiếm tài liệu và ký ức tương tự
 * 3. Kết hợp context từ tài liệu và ký ức
 * 4. Tạo prompt cho model GPT-4
 * 5. Stream câu trả lời về cho người dùng
 * 6. Lưu tin nhắn và ký ức vào database
 *
 * @param {string} question - Câu hỏi của người dùng
 * @param {string} userId - ID người dùng
 * @param {string} conversationId - ID cuộc hội thoại
 * @param {Object} res - Response object để stream kết quả
 */
async function getAnswerFromDocuments(question, userId, conversationId, res) {
  let parentRun = null;
  if (isTracingEnabled) {
    try {
      parentRun = await langsmithClient.createRun({
        name: "chatbot_conversation",
        run_type: "chain",
        inputs: { question, userId, conversationId },
        tags: [`user_${userId}`, `conversation_${conversationId}`],
        metadata: {
          timestamp: new Date().toISOString(),
        },
        project_name: "utezone",
      });
    } catch (error) {
      console.error("Error creating parent langsmith run:", error);
    }
  }

  try {
    console.log("ID người dùng get in vectorSearch:", userId);
    console.log("ID cuộc trò chuyện get in vectorSearch:", conversationId);
    console.log("Câu hỏi:", question);

    // Tìm kiếm tài liệu và ký ức tương tự
    const documents = await searchSimilarDocuments(question, parentRun?.id);
    console.log("Tài liệu tìm được:", documents);

    const memories = await searchSimilarMemories(
      question,
      userId,
      conversationId,
      parentRun?.id
    );
    console.log("Ký ức tìm được:", memories);

    // Kết hợp context từ tài liệu và ký ức
    let context = [
      ...memories.map((mem) => mem.content),
      ...documents.map((doc) => doc.content),
    ].join("\n");
    if (context.length > 1500) {
      context = context.slice(0, 1500);
    }

    // Tạo prompt cho model
    const systemMessage = new SystemMessage({
      content: `Bạn là một trợ lý ảo thân thiện, chuyên trả lời các câu hỏi về Trường Đại học Sư phạm Kỹ thuật TP.HCM (HCMUTE).
    
    Luôn ưu tiên dùng thông tin từ tài liệu cung cấp để trả lời. Nếu không có thông tin, bạn có thể trả lời bằng kiến thức tổng quát và nêu rõ điều đó.
    
    Không bịa đặt thông tin. Trả lời ngắn gọn, rõ ràng, dễ hiểu và phù hợp với sinh viên. Nếu câu hỏi không rõ, hãy yêu cầu người dùng làm rõ.`,
    });

    const humanMessage = new HumanMessage({
      content: `Câu hỏi: ${question}\n\nContext: ${context}`,
    });

    // Cấu hình response stream
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    // Stream response từ model
    const stream = await model.stream([systemMessage, humanMessage], {
      tags: [`user_${userId}`, `conversation_${conversationId}`],
      metadata: parentRun
        ? {
            run_id: parentRun.id,
            operation: "generate_response",
          }
        : undefined,
    });

    for await (const chunk of stream) {
      const token = chunk.content || "";
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }

    // Lưu tin nhắn và ký ức
    await saveMessage(userId, conversationId, question, fullResponse);

    if (fullResponse.length > 20) {
      await saveMemory(
        userId,
        conversationId,
        `Người dùng hỏi: ${question}. Trả lời: ${fullResponse.slice(0, 200)}`
      );
    }

    // Cập nhật thông tin cho LangSmith
    if (parentRun) {
      try {
        await langsmithClient.updateRun(parentRun.id, {
          outputs: {
            response: fullResponse,
            context_length: context.length,
            response_length: fullResponse.length,
          },
          metadata: {
            status: "success",
            documents_found: documents.length,
            memories_found: memories.length,
          },
          end_time: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error updating parent langsmith run:", error);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    if (parentRun) {
      try {
        await langsmithClient.updateRun(parentRun.id, {
          error: error.message,
          metadata: {
            status: "error",
            error_type: error.name,
          },
          end_time: new Date().toISOString(),
        });
      } catch (updateError) {
        console.error("Error updating parent langsmith run:", updateError);
      }
    }
    throw error;
  }
}

/**
 * Lấy thống kê về hoạt động của chatbot trong một khoảng thời gian
 * Thống kê bao gồm:
 * - Tổng số câu hỏi
 * - Thời gian phản hồi trung bình
 * - Tỷ lệ thành công
 * - Số người dùng hoạt động
 * - Top câu hỏi phổ biến
 * - Dữ liệu theo thời gian
 *
 * @param {Object} req - Request object chứa các tham số truy vấn
 * @param {string} req.query.startDate - Ngày bắt đầu (YYYY-MM-DD)
 * @param {string} req.query.endDate - Ngày kết thúc (YYYY-MM-DD)
 * @param {string} req.query.groupBy - Cách nhóm dữ liệu (mặc định: 'day')
 * @param {Object} res - Response object
 */
const getChatbotStats = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    // Kiểm tra và xác thực tham số đầu vào
    if (!startDate || !endDate) {
      return res.status(400).json({
        result: false,
        error: "Thiếu tham số bắt buộc",
        details: "startDate và endDate là bắt buộc",
      });
    }

    const startTime = new Date(startDate);
    const endTime = new Date(endDate);
    endTime.setHours(23, 59, 59, 999); // Đặt thời gian kết thúc là cuối ngày

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return res.status(400).json({
        result: false,
        error: "Định dạng ngày không hợp lệ",
        details: "Ngày phải có định dạng YYYY-MM-DD",
      });
    }

    if (startTime > endTime) {
      return res.status(400).json({
        result: false,
        error: "Khoảng thời gian không hợp lệ",
        details: "startDate phải trước endDate",
      });
    }

    console.log("Tham số truy vấn:", { startDate, endDate, groupBy });
    console.log("Đối tượng ngày:", { startTime, endTime });

    // Lấy danh sách projects từ LangSmith
    const projects = [];
    for await (const project of langsmithClient.listProjects()) {
      projects.push(project);
    }
    console.log(
      "Danh sách projects:",
      projects.map((p) => ({ id: p.id, name: p.name }))
    );

    // Lấy danh sách các run đã được xử lý từ database
    const processedRuns = await ProcessedRun.find().select("runId");
    const processedRunIds = new Set(processedRuns.map((run) => run.runId));

    // Khởi tạo các mảng để lưu trữ dữ liệu
    const runs = []; // Lưu các run từ project utezone
    const openAIRuns = []; // Lưu các run từ OpenAI
    const allRuns = []; // Lưu tất cả các run để tính thống kê

    // Lấy runs từ project utezone cho dữ liệu hội thoại
    for await (const run of langsmithClient.listRuns({
      projectName: "utezone",
      startTime,
      endTime,
      runTypes: ["chain", "llm"],
    })) {
      const runStartTime = new Date(run.start_time);
      const runEndTime = run.end_time ? new Date(run.end_time) : null;

      if (
        runStartTime >= startTime &&
        runStartTime <= endTime &&
        (!runEndTime || (runEndTime >= startTime && runEndTime <= endTime))
      ) {
        console.log(
          "Utezone Run start_time:",
          run.start_time,
          "end_time:",
          run.end_time
        );
        allRuns.push(run);

        if (!processedRunIds.has(run.id)) {
          runs.push(run);
        }
      }
    }

    // Lấy runs từ project mặc định cho thời gian phản hồi của OpenAI
    for await (const run of langsmithClient.listRuns({
      projectName: "default",
      startTime,
      endTime,
      runTypes: ["llm"],
      name: "openai_chat",
    })) {
      const runStartTime = new Date(run.start_time);
      const runEndTime = run.end_time ? new Date(run.end_time) : null;

      if (
        runStartTime >= startTime &&
        runStartTime <= endTime &&
        (!runEndTime || (runEndTime >= startTime && runEndTime <= endTime))
      ) {
        console.log(
          "Default Run start_time:",
          run.start_time,
          "end_time:",
          run.end_time
        );
        if (!processedRunIds.has(run.id)) {
          openAIRuns.push(run);
        }
      }
    }

    console.log("Số lượng runs (chỉ chain runs):", runs.length);
    console.log("Số lượng OpenAI runs:", openAIRuns.length);

    // Log thông tin chi tiết của run đầu tiên để debug
    if (runs.length > 0) {
      console.log("Run đầu tiên:", {
        id: runs[0].id,
        project_id: runs[0].project_id,
        project_name: runs[0].project_name,
        run_type: runs[0].run_type,
        name: runs[0].name,
        start_time: runs[0].start_time,
        end_time: runs[0].end_time,
        tags: runs[0].tags,
      });
    }

    if (openAIRuns.length > 0) {
      console.log("OpenAI Run đầu tiên:", {
        id: openAIRuns[0].id,
        project_id: openAIRuns[0].project_id,
        project_name: openAIRuns[0].project_name,
        run_type: openAIRuns[0].run_type,
        name: openAIRuns[0].name,
        start_time: openAIRuns[0].start_time,
        end_time: openAIRuns[0].end_time,
      });
    }

    // Khởi tạo đối tượng thống kê
    const stats = {
      totalQueries: 0,
      averageResponseTime: 0,
      successRate: 0,
      activeUsers: new Set(),
      topQuestions: [],
      timeSeriesData: new Map(),
    };

    let totalResponseTime = 0;
    let successfulRuns = 0;

    /**
     * Tính toán độ tương đồng cosine giữa hai vector
     * @param {Array} vecA - Vector thứ nhất
     * @param {Array} vecB - Vector thứ hai
     * @returns {number} Độ tương đồng cosine
     */
    function cosineSimilarity(vecA, vecB) {
      const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
      const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
      const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
      return dot / (normA * normB);
    }

    // Tính toán thống kê từ tất cả các runs
    for (const run of allRuns) {
      if (run.name === "chatbot_conversation") {
        stats.totalQueries++;
        const userId = run.tags
          ?.find((tag) => tag.startsWith("user_"))
          ?.split("_")[1];
        if (userId) stats.activeUsers.add(userId);
        if (!run.error) successfulRuns++;
      }
    }

    // Thu thập tất cả câu hỏi từ các run mới
    const allQuestions = [];
    for (const run of runs) {
      if (run.name === "chatbot_conversation") {
        const question =
          run.inputs?.question || run.inputs?.input || run.inputs?.query;
        if (question) {
          allQuestions.push({ question, runId: run.id });
        }
      }
    }

    // Xử lý từng câu hỏi mới và so sánh với các câu hỏi trong database
    for (const { question, runId } of allQuestions) {
      const embedding = await embeddings.embedQuery(question);
      const topQuestionsDB = await ChatbotTopQuestion.find();

      let found = false;
      for (const q of topQuestionsDB) {
        if (cosineSimilarity(embedding, q.embedding) > 0.85) {
          // Cập nhật số lần xuất hiện cho câu hỏi đã tồn tại
          await ChatbotTopQuestion.updateOne(
            { _id: q._id },
            { $inc: { count: 1 }, $set: { lastUpdated: new Date() } }
          );
          found = true;
          break;
        }
      }

      if (!found) {
        // Thêm câu hỏi mới vào database
        await ChatbotTopQuestion.create({
          question: question,
          embedding: embedding,
          count: 1,
          lastUpdated: new Date(),
        });
      }

      // Đánh dấu run đã được xử lý (thêm kiểm tra trước khi tạo)
      const existingProcessedRun = await ProcessedRun.findOne({ runId });
      if (!existingProcessedRun) {
        await ProcessedRun.create({
          runId: runId,
          processedAt: new Date(),
        });
      }
    }

    // Lấy top 10 câu hỏi phổ biến nhất từ database
    const topQuestions = await ChatbotTopQuestion.find()
      .sort({ count: -1, lastUpdated: -1 })
      .limit(10)
      .select("question count -_id");
    stats.topQuestions = topQuestions;

    // Xử lý các run OpenAI để lấy dữ liệu thời gian phản hồi
    const dailyResponseTimes = new Map();

    for (const run of openAIRuns) {
      if (run.end_time && run.start_time) {
        const responseTime =
          (new Date(run.end_time) - new Date(run.start_time)) / 1000;
        totalResponseTime += responseTime;

        const date = new Date(run.start_time).toLocaleDateString("en-CA");

        if (!dailyResponseTimes.has(date)) {
          dailyResponseTimes.set(date, {
            totalTime: 0,
            count: 0,
          });
        }
        const dayData = dailyResponseTimes.get(date);
        dayData.totalTime += responseTime;
        dayData.count++;
      }
    }

    // Tính toán các chỉ số thống kê cuối cùng
    stats.averageResponseTime =
      openAIRuns.length > 0 ? totalResponseTime / openAIRuns.length : 0;
    stats.successRate =
      stats.totalQueries > 0 ? (successfulRuns / stats.totalQueries) * 100 : 0;
    stats.activeUsers = stats.activeUsers.size;

    // Tạo mảng chứa tất cả các ngày trong khoảng thời gian
    const allDates = [];
    const currentDate = new Date(startTime);
    while (currentDate <= endTime) {
      allDates.push(currentDate.toLocaleDateString("en-CA"));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Đếm số lượng truy vấn cho mỗi ngày
    const dailyQueries = new Map();
    for (const run of allRuns) {
      if (run.name === "chatbot_conversation") {
        const date = new Date(run.start_time).toLocaleDateString("en-CA");
        dailyQueries.set(date, (dailyQueries.get(date) || 0) + 1);
      }
    }

    // Tạo dữ liệu chuỗi thời gian
    stats.timeSeriesData = allDates.map((date) => {
      const responseTimeData = dailyResponseTimes.get(date);
      return {
        date,
        queries: dailyQueries.get(date) || 0,
        avgResponseTime: responseTimeData
          ? responseTimeData.totalTime / responseTimeData.count
          : 0,
      };
    });

    console.log("Final time series data:", stats.timeSeriesData);

    // Log dữ liệu thống kê cuối cùng
    console.log("Dữ liệu phản hồi cuối cùng:", {
      totalQueries: stats.totalQueries,
      averageResponseTime: stats.averageResponseTime,
      successRate: stats.successRate,
      activeUsers: stats.activeUsers,
      topQuestionsCount: stats.topQuestions.length,
      timeSeriesDataCount: stats.timeSeriesData.length,
      openAIRunsCount: openAIRuns.length,
    });

    // Trả về kết quả
    res.json({
      result: true,
      data: stats,
    });
  } catch (error) {
    console.error("Lỗi khi lấy thống kê chatbot:", error);
    res.status(500).json({
      result: false,
      error: "Không thể lấy thống kê chatbot",
      details: error.message,
    });
  }
};

export {
  searchSimilarDocuments,
  saveMemory,
  saveMessage,
  getAnswerFromDocuments,
  summarizeContent,
  getChatbotStats,
};
