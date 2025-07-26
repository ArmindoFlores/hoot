import { DirectoryContents, DirectoryItem, DirectoryType, InfiniteQuery, SearchedItem } from "../types/storage";

import { ENDPOINT } from "../config";
import { Track } from "../types/tracks";
import { User } from "../types/user";

export type ApiError = {
    error: string;
};

export type ApiResponse<T> = Promise<T|ApiError>;

export function isError<T>(response: T|ApiError): response is ApiError {
    return (response as ApiError).error != undefined;
}

export function createQueryFn<T>(fn: () => ApiResponse<T>) {
    return async () => {
        const result = await fn();
        if (isError(result)) {
            throw new Error(result.error);
        }
        return result;
    };
}

async function request(endpoint: string, method: string, body?: BodyInit, json = true) {
    const headers = new Headers();
    if (json) headers.append("Content-Type", "application/json");

    const req = await fetch(`${ENDPOINT}${endpoint}`, {
        method: method,
        credentials: "include",
        headers: headers,
        body: body
    });
    if (!req.ok && req.headers.get("Content-Type") != "application/json") {
        throw new Error(`Request failed: ${req.status} ${req.statusText}`);
    }
    return req.json();
}

function addTrack(name: string, playlists: string[], file: File, parent: number|null): ApiResponse<Track> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify({
        track_name: name,
        playlists,
        parent
    }));

    return request(
        "/tracks/new",
        "POST",
        formData,
        false
    );
}

function editTrack(id: number, name: string, playlists: string[]): ApiResponse<never> {
    return request(
        `/tracks/${id}`,
        "PATCH",
        JSON.stringify({
            name,
            playlists
        })
    )
}

function addTrackFromURL(name: string, playlists: string[], source: string): ApiResponse<Track> {
    const formData = new FormData();
    formData.append("metadata", JSON.stringify({
        track_name: name,
        playlists,
        source
    }));

    return request(
        "/tracks/new",
        "POST",
        formData,
        false
    );
}

function deleteTracks(ids: number[]): ApiResponse<never> {
    return request(
        `/tracks`,
        "DELETE",
        JSON.stringify({
            ids
        })
    );
}

function addPlaylistsToTracks(trackIds: number[], playlists: string[]): ApiResponse<never> {
    return request(
        "/playlists/add_tracks",
        "POST",
        JSON.stringify({
            names: playlists,
            tracks: trackIds
        })
    );
}

function removePlaylistsFromTracks(trackIds: number[], playlists: string[]): ApiResponse<never> {
    return request(
        "/playlists/remove_tracks",
        "POST",
        JSON.stringify({
            names: playlists,
            tracks: trackIds
        })
    );
}

function setPlaylistsForTracks(trackIds: number[], playlists: string[]): ApiResponse<never> {
    return request(
        "/playlists/edit_tracks",
        "POST",
        JSON.stringify({
            names: playlists,
            tracks: trackIds
        })
    );
}

function getProfile(): ApiResponse<User> {
    return request("/user", "GET");
}

function getPlaylists(): ApiResponse<string[]> {
    return request("/playlists", "GET");
}

function getTrack(trackId: number): ApiResponse<Track> {
    return request(`/tracks/${trackId}`, "GET");
}

function getTracks(): ApiResponse<Record<string, Track[]>> {
    return request("/tracks", "GET");
}

function searchForTracks(searchString: string|null, playlists: string[]|null, offset: number = 0, limit: number = 20): ApiResponse<InfiniteQuery<SearchedItem>> {
    return request(
        "/tracks/search",
        "POST",
        JSON.stringify({
            search_string: searchString,
            playlists,
            offset,
            limit
        })
    );
}

function getDirectoryContents(id: number|null): ApiResponse<DirectoryContents> {
    return request(
        `/storage/${id}/contents`,
        "GET",
    );
}

function createDirectory(name: string, parent: number|null): ApiResponse<never> {
    return request(
        `/storage/${parent}`,
        "POST",
        JSON.stringify({
            name
        })
    );
}

function moveItems(items: { id: number, type: DirectoryItem["type"] }[], parent: number|null): ApiResponse<never> {
    return request(
        `/storage/move`,
        "POST",
        JSON.stringify({
            items,
            parent
        })
    );
}

function renameDirectory(id: number, name: string): ApiResponse<never> {
    return request(
        `/storage/${id}/rename`,
        "PATCH",
        JSON.stringify({
            name
        })
    );
}

function deleteDirectories(ids: number[]): ApiResponse<never> {
    return request(
        `/storage`,
        "DELETE",
        JSON.stringify({
            ids
        })
    );
}

function getDirectoryInfo(id: number): ApiResponse<DirectoryType> {
    return request(
        `/storage/${id}`,
        "GET",
    );
}

function login(email: string, password: string): ApiResponse<User> {
    return request(
        "/auth/login",
        "POST",
        JSON.stringify({
            email,
            password
        })
    );
}

function logout(): ApiResponse<never> {
    return request(
        "/auth/logout",
        "POST",
    );
}

function signup(email: string, username: string, password: string, confirmPassword: string): ApiResponse<never> {
    return request(
        "/user",
        "PUT",
        JSON.stringify({
            email,
            username,
            password,
            confirm_password: confirmPassword
        })
    );
}

function unlinkPatreon(): ApiResponse<never> {
    return request(
        "/user/unlink_patreon",
        "POST",
    );
}

function verifyEmail(verificationCode: string) {
    return request(
        `/auth/verify/${verificationCode}`,
        "POST"
    );
}

export const apiService = {
    addTrack,
    addTrackFromURL,
    editTrack,
    deleteTracks,
    getProfile,
    getTrack,
    getTracks,
    searchForTracks,
    addPlaylistsToTracks,
    removePlaylistsFromTracks,
    setPlaylistsForTracks,
    getDirectoryContents,
    createDirectory,
    moveItems,
    renameDirectory,
    deleteDirectories,
    getDirectoryInfo,
    getPlaylists,
    login,
    logout,
    signup,
    unlinkPatreon,
    verifyEmail,
};
