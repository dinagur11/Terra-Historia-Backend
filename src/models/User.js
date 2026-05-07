export default class User {
  constructor({
    userId,
    email = "",
    deepDiveBookmarks = [],
    deepDiveProgress = {},
    timelineProgress = {},
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    this.userId = userId;
    this.email = email;
    this.deepDiveBookmarks = deepDiveBookmarks;
    this.deepDiveProgress = deepDiveProgress;
    this.timelineProgress = timelineProgress;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromAuth(authUser) {
    return new User({
      userId: authUser.userId,
      email: authUser.email,
    });
  }

  static fromItem(item) {
    if (!item) return null;
    return new User(item);
  }

  toItem() {
    return {
      userId: this.userId,
      email: this.email,
      deepDiveBookmarks: this.deepDiveBookmarks,
      deepDiveProgress: this.deepDiveProgress,
      timelineProgress: this.timelineProgress,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toResponse() {
    return {
      userId: this.userId,
      email: this.email,
      deepDiveBookmarks: this.deepDiveBookmarks,
      deepDiveProgress: this.deepDiveProgress,
      timelineProgress: this.timelineProgress,
    };
  }
}
