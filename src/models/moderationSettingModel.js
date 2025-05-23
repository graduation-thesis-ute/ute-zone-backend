import mongoose from "mongoose";

const moderationSettingSchema = new mongoose.Schema(
  {
    entityType: {
      type: Number,
      required: true,
      enum: [1, 2, 3], // 1: Post, 2: PagePost, 3: GroupPost
      comment: "Loại bài viết cần duyệt"
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      required: function() {
        // Chỉ required khi không phải là global settings (entityType !== 1)
        return this.entityType !== 1;
      },
      comment: "ID của entity (page, group) hoặc null cho cài đặt toàn cục"
    },
    isAutoModerationEnabled: {
      type: Boolean,
      default: false,
      comment: "Bật/tắt duyệt tự động bằng AI"
    },
    isModerationRequired: {
      type: Boolean,
      default: true,
      comment: "Bật/tắt yêu cầu duyệt bài"
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      comment: "Người cập nhật cài đặt cuối cùng"
    }
  },
  {
    timestamps: true,
  }
);

// Tạo compound index để đảm bảo mỗi entity chỉ có một cài đặt duyệt
moderationSettingSchema.index({ entityType: 1, entityId: 1 }, { unique: true });

const ModerationSetting = mongoose.model("ModerationSetting", moderationSettingSchema);

export default ModerationSetting; 