import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import { formatDistanceToNow } from "../configurations/schemaConfig.js";

const formatGroupData = async (group, currentUser) => {
  const members = await GroupMember.find({ group: group._id });
  const isOwner = group.owner.equals(currentUser._id) ? 1 : 0;
  return {
    _id: group._id,
    user: {
      _id: group.owner,
      displayName: group.owner.displayName,
      avatarUrl: group.owner.avatarUrl,
    },
    name: group.name,
    description: group.description,
    avatarUrl: group.avatarUrl,
    coverUrl: group.coverUrl,
    privacy: group.privacy,
    members: members.length,
    isOwner: isOwner,
    status: group.status,
    createdAt: formatDistanceToNow(group.createdAt),
  };
};
const getListGroups = async (req) => {
  const {
    name,
    isPaged = "1",
    page = 0,
    size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
  } = req.query;

  const currentUser = req.user;
  const offset = parseInt(page, 10) * parseInt(size, 10);
  const limit = parseInt(size, 10);

  let groupQuery = {};

  if (name) {
    groupQuery.name = { $regex: name, $options: "i" };
  }

  const [totalElements, groups] = await Promise.all([
    Group.countDocuments(groupQuery),
    Group.find(groupQuery)
      .skip(offset)
      .limit(limit)
      .populate("owner")
      .sort({ createdAt: -1 }),
  ]);

  const totalPages = Math.ceil(totalElements / limit);
  const formattedGroups = await Promise.all(groups.map(group => formatGroupData(group, currentUser)));

  return {
    content: formattedGroups,
    totalPages,
    totalElements,
  };
};

export { formatGroupData, getListGroups };
