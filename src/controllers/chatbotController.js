import { Client } from "langsmith";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import ChatbotTopQuestion from "../models/chatbotTopQuestionModel.js";
import ProcessedRun from "../models/processedRunModel.js";
import "dotenv/config.js";

const langsmithClient = new Client({
  apiUrl: process.env.LANGSMITH_ENDPOINT,
  apiKey: process.env.LANGSMITH_API_KEY,
});

const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-mpnet-base-v2",
});

const getChatbotStats = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    // Kiểm tra đầu vào
    if (!startDate || !endDate) {
      return res.status(400).json({
        result: false,
        error: "Thiếu tham số bắt buộc",
        details: "startDate và endDate là bắt buộc",
      });
    }

    const startTime = new Date(startDate);
    const endTime = new Date(endDate);

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

    // Lấy danh sách projects
    const projects = [];
    for await (const project of langsmithClient.listProjects()) {
      projects.push(project);
    }
    console.log(
      "Danh sách projects:",
      projects.map((p) => ({ id: p.id, name: p.name }))
    );

    // Lấy danh sách runs đã xử lý
    const processedRuns = await ProcessedRun.find().select("runId");
    const processedRunIds = new Set(processedRuns.map((run) => run.runId));

    // Lấy runs từ LangSmith (chỉ định project 'utezone')
    const runs = [];
    const openAIRuns = []; // Array to store OpenAI runs
    const allRuns = []; // Array to store all runs for statistics

    // Fetch runs from utezone project for conversation data
    for await (const run of langsmithClient.listRuns({
      projectName: "utezone",
      startTime,
      endTime,
      runTypes: ["chain", "llm"],
    })) {
      // Kiểm tra start_time có nằm trong khoảng thời gian không
      const runStartTime = new Date(run.start_time);
      if (runStartTime >= startTime && runStartTime <= endTime) {
        console.log(
          "Utezone Run start_time:",
          run.start_time,
          "end_time:",
          run.end_time
        );
        // Lưu tất cả runs để tính thống kê
        allRuns.push(run);

        // Chỉ thêm runs chưa được xử lý vào mảng xử lý
        if (!processedRunIds.has(run.id)) {
          runs.push(run);
        }
      }
    }

    // Fetch runs from default project for OpenAI response times
    for await (const run of langsmithClient.listRuns({
      projectName: "default",
      startTime,
      endTime,
      runTypes: ["llm"],
      name: "openai_chat",
    })) {
      // Kiểm tra cả start_time và end_time có nằm trong khoảng thời gian không
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

    // Khởi tạo thống kê
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

    // Hàm cosine similarity
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

    // Gom tất cả câu hỏi từ các run mới
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

    // Process each new question and compare with DB entries
    for (const { question, runId } of allQuestions) {
      const embedding = await embeddings.embedQuery(question);
      const topQuestionsDB = await ChatbotTopQuestion.find();

      let found = false;
      for (const q of topQuestionsDB) {
        if (cosineSimilarity(embedding, q.embedding) > 0.85) {
          // Update count for existing question
          await ChatbotTopQuestion.updateOne(
            { _id: q._id },
            { $inc: { count: 1 }, $set: { lastUpdated: new Date() } }
          );
          found = true;
          break;
        }
      }

      if (!found) {
        // Add new question to DB
        await ChatbotTopQuestion.create({
          question: question,
          embedding: embedding,
          count: 1,
          lastUpdated: new Date(),
        });
      }

      // Đánh dấu run đã được xử lý
      await ProcessedRun.create({
        runId: runId,
        processedAt: new Date(),
      });
    }

    // Lấy top 10 câu hỏi phổ biến nhất từ DB (bỏ trường embedding)
    const topQuestions = await ChatbotTopQuestion.find()
      .sort({ count: -1, lastUpdated: -1 })
      .limit(10)
      .select("question count -_id");
    stats.topQuestions = topQuestions;

    // Process OpenAI runs for response time data
    for (const run of openAIRuns) {
      if (run.end_time && run.start_time) {
        const responseTime =
          (new Date(run.end_time) - new Date(run.start_time)) / 1000;
        totalResponseTime += responseTime;

        const date = new Date(run.start_time).toISOString().split("T")[0];
        if (!stats.timeSeriesData.has(date)) {
          stats.timeSeriesData.set(date, {
            queries: 0,
            avgResponseTime: 0,
            totalResponseTime: 0,
          });
        }
        const dayData = stats.timeSeriesData.get(date);
        dayData.queries++;
        dayData.totalResponseTime += responseTime;
        dayData.avgResponseTime = dayData.totalResponseTime / dayData.queries;
      }
    }

    // Tính toán thống kê cuối cùng
    stats.averageResponseTime =
      openAIRuns.length > 0 ? totalResponseTime / openAIRuns.length : 0;
    stats.successRate =
      stats.totalQueries > 0 ? (successfulRuns / stats.totalQueries) * 100 : 0;
    stats.activeUsers = stats.activeUsers.size;

    stats.timeSeriesData = Array.from(stats.timeSeriesData.entries())
      .map(([date, data]) => ({
        date,
        queries: Math.round(data.queries / 2),
        avgResponseTime: data.avgResponseTime,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log("Dữ liệu phản hồi cuối cùng:", {
      totalQueries: stats.totalQueries,
      averageResponseTime: stats.averageResponseTime,
      successRate: stats.successRate,
      activeUsers: stats.activeUsers,
      topQuestionsCount: stats.topQuestions.length,
      timeSeriesDataCount: stats.timeSeriesData.length,
      openAIRunsCount: openAIRuns.length,
    });

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

export { getChatbotStats };
