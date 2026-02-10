export interface ReviewComment {
  id: string;
  line: number | [number, number];
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewCommentsStorage {
  version: 1;
  comments: ReviewComment[];
}
