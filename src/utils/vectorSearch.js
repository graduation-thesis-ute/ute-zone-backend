import { MongoClient } from "mongodb";
import "dotenv/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import ChatbotMemory from "../models/chatbotMemoryModel.js";
import ChatbotConversation from "../models/chatbotConversationModel.js";

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
    .collection(process.env.DB_COLLECTION_VECTOR_SEARCH);

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

// Lưu tin nhắn vào ChatbotConversation
async function saveMessage(userId, conversationId, question, answer) {
  await ChatbotConversation.updateOne(
    { userId, conversationId },
    {
      $push: {
        messages: {
          $each: [
            { role: "user", content: question, timestamp: new Date() },
            { role: "assistant", content: answer, timestamp: new Date() },
          ],
        },
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
}

// Tìm kiếm ký ức tương tự
async function searchSimilarMemories(query, userId, conversationId) {
  const collection = client
    .db(process.env.DB_NAME)
    .collection(process.env.DB_COLLECTION_MEMORY_SEARCH);
  const vector = await embeddings.embedQuery(query);

  const results = await collection
    .aggregate([
      {
        $vectorSearch: {
          index: "vector_index_memories",
          path: "embedding",
          queryVector: vector,
          numCandidates: 100,
          limit: 5,
        },
      },
      {
        $match: { userId, conversationId },
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

// Lưu ký ức vào ChatbotMemory
async function saveMemory(userId, conversationId, content) {
  const embedding = await embeddings.embedQuery(content);
  await ChatbotMemory.create({
    userId,
    conversationId,
    content,
    embedding,
    timestamp: new Date(),
  });

  // Lấy lịch sử trò chuyện
  async function getConversationHistory(userId) {
    const conversation = await ChatbotConversation.findOne({ userId });
    return conversation ? conversation.messages : [];
  }
}

async function getAnswerFromDocuments(question, userId, conversationId, res) {
  console.log("ID người dùng get in vectorSearch:", userId);
  console.log("ID cuộc trò chuyện get in vectorSearch:", conversationId);
  console.log("Câu hỏi:", question);
  const documents = await searchSimilarDocuments(question);
  console.log("Tài liệu tìm được:", documents);
  const memories = await searchSimilarMemories(
    question,
    userId,
    conversationId
  );
  console.log("Ký ức tìm được:", memories);

  let context = [
    ...memories.map((mem) => mem.content),
    ...documents.map((doc) => doc.content),
  ].join("\n");
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

  await saveMessage(userId, conversationId, question, fullResponse);

  // Lưu ký ức nếu câu trả lời có ý nghĩa
  if (fullResponse.length > 50) {
    await saveMemory(
      userId,
      conversationId,
      `Người dùng hỏi: ${question}. Trả lời: ${fullResponse.slice(0, 200)}`
    );
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}

export {
  searchSimilarDocuments,
  saveMemory,
  saveMessage,
  getAnswerFromDocuments,
};
