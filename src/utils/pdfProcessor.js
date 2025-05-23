import pdfParse from "pdf-parse";
import "dotenv/config.js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { MongoClient } from "mongodb";
import DocumentModel from "../models/documentChatBotModel.js";

const client = new MongoClient(process.env.MONGODB_URI);
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-mpnet-base-v2",
});

async function processPDFAndStoreVector(buffer, filename, title) {
  if (!buffer || !filename || !title) {
    throw new Error("Buffer, filename and title are required");
  }

  try {
    await client.connect();

    const data = await pdfParse(buffer);
    const text = data.text;

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
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
