import { Client } from "langsmith";
import "dotenv/config.js";

const langsmithClient = new Client({
  apiUrl: process.env.LANGSMITH_ENDPOINT,
  apiKey: process.env.LANGSMITH_API_KEY,
});

const PROJECT_NAME = process.env.LANGSMITH_PROJECT;

// Hàm kiểm tra và tạo project nếu chưa tồn tại
const ensureProjectExists = async () => {
  try {
    // Thử lấy project
    await langsmithClient.readProject({ projectName: PROJECT_NAME });
    console.log(`Project ${PROJECT_NAME} đã tồn tại`);
  } catch (error) {
    if (error.message.includes("not found")) {
      // Tạo project mới nếu chưa tồn tại
      try {
        await langsmithClient.createProject({
          projectName: PROJECT_NAME,
          description: "UTEZone Chatbot Project",
        });
        console.log(`Đã tạo project ${PROJECT_NAME}`);
      } catch (createError) {
        console.error("Lỗi khi tạo project:", createError);
        throw new Error(
          `Không thể tạo project ${PROJECT_NAME}: ${createError.message}`
        );
      }
    } else {
      throw error;
    }
  }
  return PROJECT_NAME;
};

// Khởi tạo project khi ứng dụng khởi động
const initializeLangSmith = async () => {
  try {
    await ensureProjectExists();
    console.log("LangSmith đã được khởi tạo thành công");
  } catch (error) {
    console.error("Lỗi khi khởi tạo LangSmith:", error);
    throw error;
  }
};

export {
  langsmithClient,
  PROJECT_NAME,
  ensureProjectExists,
  initializeLangSmith,
};
