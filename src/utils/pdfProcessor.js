import pdfParse from "pdf-parse";
import "dotenv/config.js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { MongoClient } from "mongodb";
import DocumentModel from "../models/documentChatBotModel.js";

const client = new MongoClient(process.env.MONGODB_URI);
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "bkai-foundation-models/vietnamese-bi-encoder",
  dtype: "fp32",
});

async function processPDFAndStoreVector(buffer, filename, title) {
  if (!buffer || !filename || !title) {
    throw new Error("Buffer, filename and title are required");
  }

  try {
    await client.connect();

    const data = await pdfParse(buffer);
    const text = data.text.trim();
    console.log(
      "Nội dung trích xuất từ PDF (100 ký tự đầu tiên):",
      text.slice(0, 100)
    );

    if (!text || text.length === 0) {
      throw new Error("Không trích xuất được văn bản từ PDF");
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 150,
    });
    const docs = await splitter.createDocuments([text]);
    console.log(`Split into ${docs.length} chunks`);

    const collection = client
      .db(process.env.DB_NAME)
      .collection(process.env.DB_COLLECTION_VECTOR_SEARCH);

    console.log("Inserting vectors into MongoDB...", collection);

    const documentMetadata = {
      filename,
      createdAt: new Date(),
      title,
      chunkCount: docs.length,
      vectorIds: [],
    };

    for (const doc of docs) {
      const vector = await embeddings.embedQuery(doc.pageContent);
      const vectorDoc = {
        content: doc.pageContent,
        embedding: vector,
        metadata: { filename, title, createdAt: new Date() },
      };
      const result = await collection.insertOne(vectorDoc);
      console.log("✅ Đã lưu embedding:", vector.slice(0, 5));
      documentMetadata.vectorIds.push(result.insertedId.toString());
    }

    const newDoc = new DocumentModel(documentMetadata);
    await newDoc.save();

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
