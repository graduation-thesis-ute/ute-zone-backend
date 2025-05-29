import mongoose from "mongoose";
import { schemaOptions } from "../configurations/schemaConfig.js";

const PageFollowerSchema = new mongoose.Schema(
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
    },
    schemaOptions
)

const PageFollower = mongoose.model("PageFollower", PageFollowerSchema);
export default PageFollower;