import { Track } from "./tracks";

export interface DirectoryType {
    type: "DIRECTORY";
    id: number;
    name: string;
}

export type DirectoryItem = DirectoryType | (
    { type: "TRACK" } & Track
);

export type DirectoryContents = DirectoryItem[];

export type SearchedItem = DirectoryItem & { directory_id: number|null };

export interface InfiniteQuery<T>{
    data: T[];
    total: number;
    offset: number;
    limit: number;
}
