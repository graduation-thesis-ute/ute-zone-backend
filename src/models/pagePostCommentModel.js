import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";
import { deleteFileByUrl } from "../services/apiService.js";

const PagePostCommentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        pagePost:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "PagePost",
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        imageUrl: {
            type: String,
            default: null,
        },
        parent:{
            type: mongoose.Schema.Types.ObjectId,
            ref:"PagePostComment",
            default: null,
        },
    },
    schemaOptions
)
PagePostCommentSchema.pre(
    "deleteOne",
    { document: true, query: false},
    async function (next) {
        const commentId = this._id;
        try {
            await deleteFileByUrl(this.imageUrl);
            const childComments = await this.model("PagePostComment").find({
                parent: commentId,
              });
              for (const childComment of childComments) {
                await childComment.deleteOne();
              }
        } catch (error) {
            next(error);
        }
        
    }
)
const PagePostComment = mongoose.model("PagePostComment", PagePostCommentSchema);
export default PagePostComment;