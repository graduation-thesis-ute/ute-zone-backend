import { MongoClient } from "mongodb";
import "dotenv/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";

const client = new MongoClient(process.env.MONGODB_URI);
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-mpnet-base-v2",
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

async function getAnswerFromDocuments(query) {
  const documents = await searchSimilarDocuments(query);
  console.log("Tài liệu tìm được:", documents);

  let context = documents.map((doc) => doc.content).join("\n");

  if (context.length > 1500) {
    context = context.substring(0, 1500);
  }

  const systemMessage = new SystemMessage({
    content: `Bạn là trợ lý AI giúp người dùng tìm kiếm thông tin về Trường Đại học Sư phạm Kỹ thuật Thành phố Hồ Chí Minh (HCMUTE).
      Trường được thành lập năm 1995 và chuyên đào tạo các ngành về kỹ thuật, công nghệ, và giáo dục. Trường có cơ sở tại Thành phố Hồ Chí Minh và cam kết cung cấp môi trường học tập hiện đại, đào tạo đa ngành nghề. Các sinh viên của trường được trang bị kiến thức và kỹ năng để phục vụ nhu cầu phát triển của ngành công nghiệp và xã hội.
      Hãy trả lời mọi câu hỏi liên quan đến trường HCMUTE một cách chi tiết và rõ ràng.`,
  });
  console.log("humanMessage:", query, context);
  const humanMessage = new HumanMessage({
    content: `Câu hỏi: ${query}\n\nContext: ${context}`,
  });

  const response = await model.call([systemMessage, humanMessage]);

  return response.text;
}

export { searchSimilarDocuments, getAnswerFromDocuments };
