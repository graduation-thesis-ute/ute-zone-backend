import mongoose from "mongoose";
import { formatDate, schemaOptions } from "../configurations/schemaConfig.js";
import { deleteFileByUrl } from "../services/apiService.js";

const PageSchema = new mongoose.Schema(
    {
        name:{
            type: String,
            required: true,
        },
        description:{
            type: String,
            required: true,
        },
        avatarUrl:{
            type: String,
            default: null,
        },
        coverUrl: {
            type: String,
            default: null,
        },
        category: {
            type: String,
            required: true,
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        kind: {
            type: Number,
            enum: [1, 2], //1.public 2. follower only
            default: 1,
        },
        status: {
            type: Number,
            enum: [1, 2, 3], //1. inactive, 2: active, 3: deleted
            default: 1,
        },
    },
    schemaOptions
);

PageSchema.pre(
    "deleteOne",
    { document: true, query: false},
    async function (next) {
        try {
            await deleteFileByUrl(this.avataUrl);
            await deleteFileByUrl(this.coverUrl);
        } catch (error){
               next(error); 
        }
    }
)

const Page = mongoose.model("Page", PageSchema);
export default Page;