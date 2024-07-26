import { faVolumeHigh, faVolumeLow, faVolumeMute, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";
import { useOBR, useOBRMessaging } from "../react-obr/providers";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MessageContent } from "../types/messages";
import ReactSlider from "react-slider";
import { SimpleTrack } from "../types/tracks";

type TrackWithDuration = SimpleTrack & { duration?: number };

function PlayerAudioIndicator({ playlist, globalVolume, track }: { playlist: string, globalVolume: number, track?: SimpleTrack }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    const [ trackWithDuration, setTrackWithDuration ] = useState<TrackWithDuration|undefined>(track);
    const [ loaded, setLoaded ] = useState(false);

    const setPlaybackTime = (time: number) => {
        setTrackWithDuration(old => old ? { ...old, time } : old);
    }

    useEffect(() => {
        if (loaded && audioRef.current && trackWithDuration) {
            audioRef.current.volume = globalVolume * trackWithDuration.volume;
        }
    }, [globalVolume, trackWithDuration?.volume, loaded]);

    useEffect(() => {
        if (audioRef.current && track) {
            const timeOffset = Math.abs(audioRef.current.currentTime - track.time);
            if (timeOffset > 1) {
                audioRef.current.currentTime = track.time;
            }
        }
        setTrackWithDuration(old => {
            if (old === undefined) {
                return track;
            }
            if (old.name === track?.name && old.source === track?.source) {
                return {
                    ...track,
                    duration: old.duration
                };
            }
            setLoaded(false);
            return track;
        });
    }, [track]);

    useEffect(() => {
        if (loaded) {
            if (trackWithDuration!.playing) {
                audioRef.current!.play();
            }
            else {
                audioRef.current!.pause();
            }
        }
    }, [loaded, trackWithDuration]);

    useEffect(() => {
        if (loaded) {
            setTrackWithDuration(old => old ? { ...old, duration: audioRef.current?.duration } : old );
        }
    }, [loaded]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (audioElement) {
            const handleTimeUpdate = () => {
                setPlaybackTime(audioElement.currentTime);
            };

            audioElement.addEventListener("timeupdate", handleTimeUpdate);

            return () => audioElement.removeEventListener("timeupdate", handleTimeUpdate);
        }
    }, [trackWithDuration?.name, trackWithDuration?.source]);

    return <div key={playlist} className="audio-indicator">
        <audio src={trackWithDuration?.source} ref={audioRef} onCanPlayThrough={() => setLoaded(true)} />
        <div className="audio-indicator-top-row">
            <p style={{fontWeight: "bold"}}>{ playlist }</p>
            <FontAwesomeIcon icon={faVolumeHigh} style={{opacity: trackWithDuration?.playing ? 1 : 0}} />
        </div>
        <div className="progressbar-container">
            {
                trackWithDuration && 
                <ReactSlider
                    className="progressbar"
                    thumbClassName="progressbar-thumb"
                    trackClassName="progressbar-track"
                    orientation="horizontal"
                    min={0}
                    max={500}
                    value={trackWithDuration.duration ? (trackWithDuration.time / trackWithDuration.duration * 500) : 0}
                    disabled
                />
            }
        </div>
    </div>;
}

export function PlayerView() {
    const { registerMessageHandler, sendMessage } = useOBRMessaging();
    const { party } = useOBR();

    const [ playlists, setPlaylists ] = useState<string[]>([]);
    // const [ playlistVolumes, setPlaylistVolumes ] = useState<Record<string, number>>({});
    const [ tracks, setTracks ] = useState<Record<string, TrackWithDuration>>({});
    const [ GMIDs, setGMIDs ] = useState<string[]>([]);
    const [ setup, setSetup ] = useState(false);
    const [ volume, setVolume ] = useState(0.5);
    const [ previousVolume, setPreviousVolume ] = useState(0.5);
    const [ volumeHovered, setVolumeHovered ] = useState(false);
    const [ mute, setMute ] = useState(false);

    const toggleMute = () => {
        if (volume === 0) {
            setVolume(previousVolume);
        }
        else {
            setPreviousVolume(volume);
            setMute(true);
            setVolume(0);
        }
    }

    useEffect(() => {
        if (volume !== 0) {
            setMute(false);
        }
    }, [volume]);

    useEffect(() => {
        return registerMessageHandler(message => {
            const messageContent = message.message as MessageContent;
            if (messageContent.type === "track") {
                console.log("Got track info:", messageContent.payload);
                const track = messageContent.payload as SimpleTrack;
                setTracks(oldTracks => {
                    const prev = oldTracks[track.playlist];
                    if (prev && prev.name === track.name && prev.source == track.source) {
                        return {...oldTracks, [track.playlist]: { ...prev, ...track } }    
                    }
                    return {...oldTracks, [track.playlist]: track }
                });
            }
            else if (messageContent.type === "playlists") {
                console.log("Got playlists info:", messageContent.payload);
                const newPlaylists = messageContent.payload as string[];
                for (const playlist of newPlaylists) {
                    if (!playlists.includes(playlist)) {
                        sendMessage({ type: "get-track", payload: playlist }, GMIDs);
                    }
                }
                setPlaylists(newPlaylists);
            }
            else {
                console.error(`Received invalid message of type '${messageContent.type}':`, messageContent.payload);
            }
        });
    }, []);

    useEffect(() => {
        if (!setup && party && party.length >= 1) {
            const GMs = party.filter(player => player.role === "GM");
            if (GMs.length == 0) {
                return;
            }
            const GMIDs = GMs.map(gm => gm.id);
            sendMessage({ type: "get-playlists" }, GMIDs);
            setSetup(true);
            setGMIDs(GMIDs);
        }
    }, [party, setup]);

    return <div className="player-view">
        <h2>Currently Playing</h2>
        <div className="player-track-display">
            {
                playlists.length === 0 &&
                <p>
                    No tracks are playing. 
                </p>
            }
            {
                playlists.map(playlist => (
                    <PlayerAudioIndicator key={playlist} playlist={playlist} track={tracks[playlist]} globalVolume={volume} />
                ))
            }
        </div>
        <div className="global-volume" onMouseEnter={() => setVolumeHovered(true)}onMouseLeave={() => setVolumeHovered(false)}>
            <div className={`global-volume-slider-container ${volumeHovered ? "global-volume-shown" : ""}`}>
                <ReactSlider
                    className="volume-slider"
                    thumbClassName={`volume-slider-thumb`}
                    trackClassName={`volume-slider-track`}
                    min={0}
                    max={100}
                    value={(volume ?? 0) * 100}
                    onChange={value => setVolume(value / 100)}
                    orientation="vertical"
                    invert
                />
            </div>
            <div 
                className="global-volume-icon-container clickable"
                onClick={toggleMute}
            >
                <FontAwesomeIcon 
                    icon={
                        mute
                        ? faVolumeMute
                        : volume == 0 
                        ? faVolumeOff 
                        : (volume < 0.5)
                        ? faVolumeLow
                        : faVolumeHigh
                    } 
                    style={{width: "1rem"}}
                />
            </div>
        </div>
    </div>;
}
