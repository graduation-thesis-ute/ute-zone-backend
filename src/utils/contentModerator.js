import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  trimMessages,
} from "@langchain/core/messages";
import "dotenv/config.js";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});

export async function moderateContent(postText) {
  const messages = [
    new SystemMessage(
      "Bạn là một AI kiểm duyệt nội dung mạng xã hội. Hãy phân tích bài viết và trả lời 'APPROVED' nếu nội dung phù hợp, hoặc 'REJECTED' nếu vi phạm các quy tắc như: bạo lực, tục tĩu, quấy rối, phân biệt chủng tộc, thông tin sai lệch."
    ),
    new HumanMessage(`Bài viết: "${postText}"`),
  ];

  const result = await model.call(messages);
  const verdict = result.text.trim().toUpperCase();

  return {
    result: verdict,
    isApproved: verdict.includes("APPROVED"),
    reason: result.text.trim(),
  };
}
