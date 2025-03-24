import { ENDPOINT } from "../config";
import { OnlineTrack } from "../types/tracks";
import { Track } from "../components/TrackProvider";
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

function addTrack(name: string, playlists: string[], file: File): ApiResponse<OnlineTrack> {
    console.log(file);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify({
        track_name: name,
        playlists: playlists
    }));

    return request(
        "/tracks/new",
        "POST",
        formData,
        false
    );
}

function addTrackFromURL(name: string, playlists: string[], source: string): ApiResponse<OnlineTrack> {
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

function deleteTrack(id: number, playlist?: string): ApiResponse<OnlineTrack> {
    return request(
        `/tracks/${id}`,
        "DELETE",
        JSON.stringify({
            playlist
        })
    );
}

function getProfile(): ApiResponse<User> {
    return request("/user", "GET");
}

function getTrack(trackId: number): ApiResponse<OnlineTrack> {
    return request(`/tracks/${trackId}`, "GET");
}

function getTracks(): ApiResponse<Record<string, Track[]>> {
    return request("/tracks", "GET");
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

function verifyEmail(verificationCode: string) {
    return request(
        `/auth/verify/${verificationCode}`,
        "POST"
    );
}

export const apiService = {
    addTrack,
    addTrackFromURL,
    deleteTrack,
    getProfile,
    getTrack,
    getTracks,
    login,
    logout,
    signup,
    verifyEmail,
};
