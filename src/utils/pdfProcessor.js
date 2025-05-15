import pdfParse from "pdf-parse";
import "dotenv/config.js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
// import { OpenAIEmbeddings } from "@langchain/openai";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-mpnet-base-v2",
});
// const embeddings = new OpenAIEmbeddings({
//   modelName: "text-embedding-3-large",
//   apiKey: process.env.OPENAI_API_KEY,
// });
async function processPDFAndStoreVector(buffer) {
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

  for (const doc of docs) {
    const vector = await embeddings.embedQuery(doc.pageContent);
    await collection.insertOne({
      content: doc.pageContent,
      embedding: vector,
      metadata: doc.metadata || {},
    });
    console.log("✅ Đã lưu embedding:", vector.slice(0, 5));
  }
}

export { processPDFAndStoreVector };
