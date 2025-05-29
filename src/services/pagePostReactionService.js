import mongoose from "mongoose";
import PagePostReaction from "../models/pagePostReactionModel.js";

const formatPagePostReactionData = (pagePostReaction) =>{
    return {
        _id: pagePostReaction._id,
        user:{
            _id: pagePostReaction.user.id,
            displayName: pagePostReaction.user.displayName,
            avatarUrl: pagePostReaction.user.avatarUrl,
        },
        pagePost:{
            _id: pagePostReaction.pagePost,
        },
    };
};

const getListPagePostReactions = async (req)=>{
    const {
        pagePost,
        isPaged,
        page = 0,
        size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
    } = req.query;
    const offset = parseInt(page, 10) * parseInt(size, 10);
    const limit = parseInt(size, 10);
  
    let query = {};
    if (mongoose.isValidObjectId(pagePost)) {
      query.post = new mongoose.Types.ObjectId(pagePost);
    }
  
    const [totalElements, pagePostReactions] = await Promise.all([
      PagePostReaction.countDocuments(query),
      PagePostReaction.find(query)
        .populate("user")
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
    ]);
  
    const totalPages = Math.ceil(totalElements / limit);
  
    const result = pagePostReactions.map((pagePostReaction) => {
      return formatPagePostReactionData(pagePostReaction);
    });
  
    return {
      content: result,
      totalPages,
      totalElements,
    };
  };

export { getListPagePostReactions }