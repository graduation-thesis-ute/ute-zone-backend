import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";

const PageMemberSchema = new mongoose.Schema(
    {
        page: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Page",
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        role: {
            type: Number,
            enum: [1, 2, 3], // // 1: owner: Chủ sở hữu Page, 2: admin: Có quyền quản lý toàn bộ Page., 3: editor: Chỉ có quyền đăng bài.
            default: 1,
        },
    },
    schemaOptions
);
 const PageMember = mongoose.model(
    "PageMember", PageMemberSchema
);
export default PageMember;