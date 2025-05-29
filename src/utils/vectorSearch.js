import { MongoClient } from "mongodb";
import "dotenv/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { Client } from "langsmith";
import ChatbotMemory from "../models/chatbotMemoryModel.js";
import ChatbotConversation from "../models/chatbotConversationModel.js";

const client = new MongoClient(process.env.MONGODB_URI);
const isTracingEnabled = process.env.LANGSMITH_TRACING === "true";
const langsmithClient = isTracingEnabled
  ? new Client({
      apiUrl: process.env.LANGSMITH_ENDPOINT,
      apiKey: process.env.LANGSMITH_API_KEY,
    })
  : null;

// Cache để tránh duplicate runs
const runCache = new Map();

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  ...(isTracingEnabled && {
    callbacks: [
      {
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

const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "bkai-foundation-models/vietnamese-bi-encoder",
  dtype: "fp32",
});

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

// Lưu tin nhắn vào ChatbotConversation
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

// Tìm kiếm ký ức tương tự
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

// Hàm tóm tắt nội dung bằng AI
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

// Lưu ký ức vào ChatbotMemory
async function saveMemory(userId, conversationId, content) {
  // Tóm tắt nội dung trước khi lưu
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

// Lấy lịch sử trò chuyện
async function getConversationHistory(userId) {
  const conversation = await ChatbotConversation.findOne({ userId });
  return conversation ? conversation.messages : [];
}

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

    const documents = await searchSimilarDocuments(question, parentRun?.id);
    console.log("Tài liệu tìm được:", documents);

    const memories = await searchSimilarMemories(
      question,
      userId,
      conversationId,
      parentRun?.id
    );
    console.log("Ký ức tìm được:", memories);

    let context = [
      ...memories.map((mem) => mem.content),
      ...documents.map((doc) => doc.content),
    ].join("\n");
    if (context.length > 1500) {
      context = context.slice(0, 1500);
    }

    const systemMessage = new SystemMessage({
      content: `Bạn là một trợ lý ảo thân thiện và thông minh, được thiết kế để trả lời các câu hỏi liên quan đến Trường Đại học Sư phạm Kỹ thuật TP.HCM (HCMUTE).

Khi người dùng đặt câu hỏi liên quan đến HCMUTE (chẳng hạn như các khoa, ngành học, tuyển sinh, học phí, địa chỉ, hoạt động sinh viên…), bạn phải ưu tiên sử dụng thông tin từ tài liệu đã cung cấp (RAG) để đưa ra câu trả lời chính xác và đáng tin cậy.

Nếu không tìm thấy câu trả lời trong tài liệu, hãy trả lời dựa trên kiến thức tổng quát hoặc nói rõ là bạn không chắc chắn, tránh suy đoán.

Nếu người dùng đặt câu hỏi không liên quan đến HCMUTE, bạn vẫn có thể trả lời dựa trên khả năng hiểu biết chung của bạn, miễn là câu hỏi không vi phạm chính sách hoặc đạo đức.

Luôn trả lời một cách lịch sự, ngắn gọn nhưng đầy đủ ý, dễ hiểu và phù hợp với ngữ cảnh của sinh viên hoặc người quan tâm đến HCMUTE.

Nếu câu hỏi mơ hồ, hãy khuyến khích người dùng làm rõ. Nếu được yêu cầu trích dẫn nguồn, hãy ghi chú rõ nếu thông tin đến từ tài liệu hoặc từ hiểu biết tổng quát.`,
    });

    const humanMessage = new HumanMessage({
      content: `Câu hỏi: ${question}\n\nContext: ${context}`,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

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

    await saveMessage(userId, conversationId, question, fullResponse);

    if (fullResponse.length > 50) {
      await saveMemory(
        userId,
        conversationId,
        `Người dùng hỏi: ${question}. Trả lời: ${fullResponse.slice(0, 200)}`
      );
    }

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

export {
  searchSimilarDocuments,
  saveMemory,
  saveMessage,
  getAnswerFromDocuments,
  summarizeContent,
};
