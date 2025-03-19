import mongoose from "mongoose";
import Page from "../models/pageModel.js";
import PageFollower from "../models/pageFollowerModel.js";
import { formatDistanceToNow } from "../configurations/schemaConfig.js";

const formatPageData = async (page, currentUser) => {
    const followers = await PageFollower.find({ page: page._id });
    const isOwner = page.creator._id.equals(currentUser._id) ? 1 : 0;
    
    return {
        _id: page._id,
        user: {
            _id: page.creator._id,
            displayName: page.creator.displayName,
            avatarUrl: page.creator.avatarUrl,
            role: {
                _id: page.creator.role._id,
                name: page.creator.role.name,
                kind: page.creator.role.kind,
            },
        },
        name: page.name,
        description: page.description,
        avatarUrl: page.avatarUrl,
        coverUrl: page.coverUrl,
        category: page.category,
        createdAt: formatDistanceToNow(page.createdAt),
        totalFollowers: followers.length,
        isOwner: isOwner,
    };
};

const getListPages = async (req) => {
    const {
        name,
        isPaged = "1",
        page = 0,
        size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
    } = req.query;

    const currentUser = req.user;
    const offset = parseInt(page, 10) * parseInt(size, 10);
    const limit = parseInt(size, 10);
    
    let pageQuery = {};
    
    if (name) {
        pageQuery.name = { $regex: name, $options: "i" };
    }
    
    const [totalElements, pages] = await Promise.all([
        Page.countDocuments(pageQuery),
        Page.find(pageQuery)
            .populate("creator")
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit),
    ]);
    
    const totalPages = Math.ceil(totalElements / limit);
    const formattedPages = await Promise.all(pages.map(page => formatPageData(page, currentUser)));
    
    return {
        content: formattedPages,
        totalPages,
        totalElements,
    };
};

export {formatPageData, getListPages };
