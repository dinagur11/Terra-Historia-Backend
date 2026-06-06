export default class User {
  constructor({
    userId,
    name = "",
    email = "",
    deepDiveBookmarks = [],
    deepDiveProgress = {},
    timelineProgress = {},
    suggestions = [],
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    this.userId = userId;
    this.name = name;
    this.email = email;
    this.deepDiveBookmarks = deepDiveBookmarks;
    this.deepDiveProgress = deepDiveProgress;
    this.timelineProgress = timelineProgress;
    this.suggestions = suggestions;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static fromAuth(authUser) {
    return new User({
      userId: authUser.userId,
      name: authUser.name,
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
      name: this.name,
      email: this.email,
      deepDiveBookmarks: this.deepDiveBookmarks,
      deepDiveProgress: this.deepDiveProgress,
      timelineProgress: this.timelineProgress,
      suggestions: this.suggestions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toResponse() {
    return {
      userId: this.userId,
      name: this.name,
      email: this.email,
      deepDiveBookmarks: this.deepDiveBookmarks,
      deepDiveProgress: this.deepDiveProgress,
      timelineProgress: this.timelineProgress,
      suggestions: this.suggestions,
    };
  }
}
