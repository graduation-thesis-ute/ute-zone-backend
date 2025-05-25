import { Client } from "langsmith";
import "dotenv/config.js";

const langsmithClient = new Client({
  apiUrl: process.env.LANGSMITH_ENDPOINT,
  apiKey: process.env.LANGSMITH_API_KEY,
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

    // Lấy runs từ LangSmith (chỉ định project 'default')
    const runs = [];
    for await (const run of langsmithClient.listRuns({
      projectName: "default",
      startTime,
      endTime,
      runTypes: ["chain"],
    })) {
      runs.push(run);
    }

    console.log("Số lượng runs (chỉ chain runs):", runs.length);
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
    } else {
      console.log("Không tìm thấy runs nào trong khoảng thời gian này");
    }

    // Khởi tạo thống kê
    const stats = {
      totalQueries: 0,
      averageResponseTime: 0,
      successRate: 0,
      activeUsers: new Set(),
      topQuestions: new Map(),
      timeSeriesData: new Map(),
    };

    let totalResponseTime = 0;
    let successfulRuns = 0;

    // Xử lý từng run
    for (const run of runs) {
      console.log("Đang xử lý run:", {
        run_type: run.run_type,
        name: run.name,
        has_error: !!run.error,
        start_time: run.start_time,
        end_time: run.end_time,
        tags: run.tags,
        inputs: run.inputs,
      });

      if (run.run_type === "chain" || run.run_type === "llm") {
        stats.totalQueries++;

        // Log chi tiết tags và inputs để debug
        console.log("Run tags:", run.tags);
        console.log("Run inputs:", run.inputs);

        const userId = run.tags
          ?.find((tag) => tag.startsWith("user_"))
          ?.split("_")[1];
        if (userId) stats.activeUsers.add(userId);

        if (!run.error) successfulRuns++;

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

        const question =
          run.inputs?.question || run.inputs?.input || run.inputs?.query;
        if (question) {
          stats.topQuestions.set(
            question,
            (stats.topQuestions.get(question) || 0) + 1
          );
        }
      }
    }

    // Tính toán thống kê cuối cùng
    stats.averageResponseTime =
      stats.totalQueries > 0 ? totalResponseTime / stats.totalQueries : 0;
    stats.successRate =
      stats.totalQueries > 0 ? (successfulRuns / stats.totalQueries) * 100 : 0;
    stats.activeUsers = stats.activeUsers.size;

    stats.topQuestions = Array.from(stats.topQuestions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }));

    stats.timeSeriesData = Array.from(stats.timeSeriesData.entries())
      .map(([date, data]) => ({
        date,
        queries: data.queries,
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
