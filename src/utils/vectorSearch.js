import { MongoClient } from "mongodb";
import "dotenv/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";

const client = new MongoClient(process.env.MONGODB_URI);

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});

const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-mpnet-base-v2",
  dtype: "fp16",
});

async function searchSimilarDocuments(query) {
  const collection = client
    .db(process.env.DB_NAME)
    .collection(process.env.DB_COLLECTION);

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

  return results;
}

async function getAnswerFromDocuments(question, res) {
  console.log("Câu hỏi:", question);
  const documents = await searchSimilarDocuments(question);
  console.log("Tài liệu tìm được:", documents);

  let context = documents.map((doc) => doc.content).join("\n");
  if (context.length > 1500) {
    context = context.slice(0, 1500);
  }

  const systemMessage = new SystemMessage({
    content: `Bạn là trợ lý AI giúp người dùng tìm kiếm thông tin về Trường Đại học Sư phạm Kỹ thuật Thành phố Hồ Chí Minh (HCMUTE).`,
  });

  const humanMessage = new HumanMessage({
    content: `Câu hỏi: ${question}\n\nContext: ${context}`,
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = await model.stream([systemMessage, humanMessage]);

  for await (const chunk of stream) {
    const token = chunk.content || "";
    fullResponse += token;
    res.write(`data: ${JSON.stringify({ token })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}

export { searchSimilarDocuments, getAnswerFromDocuments };
