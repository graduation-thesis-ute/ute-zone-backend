import pdfParse from "pdf-parse";
import "dotenv/config.js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { MongoClient } from "mongodb";
import DocumentModel from "../models/chatbotDocument.js";

/**
 * Khởi tạo kết nối MongoDB
 * Sử dụng để lưu trữ các vector embedding và metadata của tài liệu
 */
const client = new MongoClient(process.env.MONGODB_URI);

/**
 * Khởi tạo model embedding tiếng Việt
 * Sử dụng model "bkai-foundation-models/vietnamese-bi-encoder" để tạo vector embedding
 * cho nội dung tài liệu tiếng Việt
 */
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "bkai-foundation-models/vietnamese-bi-encoder",
  dtype: "fp32",
});

/**
 * Xử lý file PDF và lưu trữ vector embedding
 * Quy trình xử lý:
 * 1. Trích xuất văn bản từ file PDF
 * 2. Chia văn bản thành các đoạn nhỏ (chunks)
 * 3. Tạo vector embedding cho từng đoạn
 * 4. Lưu vector và metadata vào MongoDB
 * 5. Lưu thông tin tài liệu vào collection documents
 *
 * @param {Buffer} buffer - Buffer chứa nội dung file PDF
 * @param {string} filename - Tên file PDF
 * @param {string} title - Tiêu đề tài liệu
 * @returns {Object} Thông tin về tài liệu đã được xử lý, bao gồm:
 *   - _id: ID của tài liệu
 *   - filename: Tên file
 *   - title: Tiêu đề
 *   - createdAt: Thời gian tạo
 *   - chunkCount: Số lượng đoạn văn bản
 *   - vectorIds: Danh sách ID của các vector embedding
 * @throws {Error} Nếu thiếu tham số bắt buộc hoặc không trích xuất được văn bản
 */
async function processPDFAndStoreVector(buffer, filename, title) {
  if (!buffer || !filename || !title) {
    throw new Error("Buffer, filename and title are required");
  }

  try {
    await client.connect();

    // Trích xuất văn bản từ PDF
    const data = await pdfParse(buffer);
    const text = data.text.trim();
    console.log(
      "Nội dung trích xuất từ PDF (100 ký tự đầu tiên):",
      text.slice(0, 100)
    );

    if (!text || text.length === 0) {
      throw new Error("Không trích xuất được văn bản từ PDF");
    }

    // Chia văn bản thành các đoạn nhỏ
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500, // Kích thước mỗi đoạn
      chunkOverlap: 150, // Độ chồng lấp giữa các đoạn
    });
    const docs = await splitter.createDocuments([text]);
    console.log(`Split into ${docs.length} chunks`);

    // Lấy collection để lưu vector
    const collection = client
      .db(process.env.DB_NAME)
      .collection(process.env.DB_COLLECTION_VECTOR_SEARCH);

    console.log("Inserting vectors into MongoDB...", collection);

    // Tạo metadata cho tài liệu
    const documentMetadata = {
      filename,
      createdAt: new Date(),
      title,
      chunkCount: docs.length,
      vectorIds: [],
    };

    // Xử lý từng đoạn văn bản
    for (const doc of docs) {
      // Tạo vector embedding cho đoạn văn bản
      const vector = await embeddings.embedQuery(doc.pageContent);
      const vectorDoc = {
        content: doc.pageContent,
        embedding: vector,
        metadata: { filename, title, createdAt: new Date() },
      };
      // Lưu vector vào MongoDB
      const result = await collection.insertOne(vectorDoc);
      console.log("✅ Đã lưu embedding:", vector.slice(0, 5));
      documentMetadata.vectorIds.push(result.insertedId.toString());
    }

    // Lưu thông tin tài liệu
    const newDoc = new DocumentModel(documentMetadata);
    await newDoc.save();

    // Trả về thông tin tài liệu đã xử lý
    return {
      _id: newDoc._id.toString(),
      filename: newDoc.filename,
      title: newDoc.title,
      createdAt: newDoc.createdAt,
      chunkCount: newDoc.chunkCount,
      vectorIds: newDoc.vectorIds,
    };
  } finally {
    await client.close();
  }
}

export { processPDFAndStoreVector };
