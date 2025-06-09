import { Client } from "langsmith";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import ChatbotTopQuestion from "../models/chatbotTopQuestionModel.js";
import ProcessedRun from "../models/processedRunModel.js";
import "dotenv/config.js";

// Khởi tạo LangSmith client để theo dõi và phân tích các cuộc hội thoại
const langsmithClient = new Client({
  apiUrl: process.env.LANGSMITH_ENDPOINT,
  apiKey: process.env.LANGSMITH_API_KEY,
});

// Khởi tạo model embedding để tính toán độ tương đồng giữa các câu hỏi
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-mpnet-base-v2",
});

/**
 * Lấy thống kê về hoạt động của chatbot trong một khoảng thời gian
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

export { getChatbotStats };
