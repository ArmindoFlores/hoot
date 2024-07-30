import { Track, useTracks } from "./TrackProvider";
import { faBackward, faClose, faForward, faPause, faPlay, faRepeat, faShuffle, faVolumeHigh, faVolumeLow, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { fadeInVolume, fadeOutVolume } from "../utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import FadeIn from "../assets/fadein.svg";
import FadeOut from "../assets/fadeout.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MessageContent } from "../types/messages";
import ReactSlider from "react-slider";
import RepeatSelf from "../assets/repeat-self.svg";
import { useAudioPlayer } from "./AudioPlayerProvider";
import { useOBRMessaging } from "../react-obr/providers";
import { useSettings } from "./SettingsProvider";
import { useThrottled } from "../hooks";

export interface AudioControlsProps {
    playlist: string;
}

function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const formattedMinutes = minutes.toString().padStart(2, "0");
    const formattedSeconds = Math.floor(secs).toString().padStart(2, "0");

    if (hours > 0) {
        const formattedHours = hours.toString().padStart(2, "0");
        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
        return `${formattedMinutes}:${formattedSeconds}`;
    }
}

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [array[i], array[j]] = [array[j], array[i]]; 
    } 
    return array; 
}

export function AudioControls(props: AudioControlsProps) {
    const { 
        volume, 
        playing, 
        setTrack,
        setVolume,
        setPlaybackTime,
        setDuration,
        setShuffle,
        setIsPlaying,
        setLoaded,
        setRepeatMode
    } = useAudioPlayer();
    const { fadeTime } = useSettings();
    const { tracks } = useTracks();
    const { sendMessage, registerMessageHandler } = useOBRMessaging();

    const current = useMemo(() => playing[props.playlist], [playing]);
    const audioRef = useRef<HTMLAudioElement>(null);
    
    const [ shuffled, setShuffled ] = useState<typeof tracks>(new Map());
    const [ loaded, setTrackLoaded ] = useState(false);
    const [ scheduledUpdate, setScheduledUpdate ] = useState(false);
    const [ fading, setFading ] = useState(false);

    const throttledSend = useThrottled(sendMessage, 250, "trailing");

    const sendTrackUpdates = () => {
        setScheduledUpdate(true);
    }

    const setCurrentTrack = (track?: Track) => {
        setTrack(track, props.playlist);
        sendTrackUpdates();
    }
    
    const setAudioTime = (time: number) => {
        const audioElement = audioRef.current;
        if (audioElement) {
            audioRef.current.currentTime = time;
            setPlaybackTime(audioElement.currentTime, props.playlist);
            sendTrackUpdates();
        }
    }

    const nextRepeatMode = () => {
        if (current.repeatMode === "no-repeat") {
            setRepeatMode("repeat-all", props.playlist);
        }
        else if (current.repeatMode === "repeat-all") {
            setRepeatMode("repeat-self", props.playlist);
        }
        else {
            setRepeatMode("no-repeat", props.playlist);
        }
    }

    const changeTrack = (offset: number) => {
        if (fading) return;
        const playlistTracks = (current.shuffle ? shuffled : tracks).get(props.playlist)!;
        const currentIndex = playlistTracks.findIndex(track => track.name === current.track.name);
        const nextIndex = (currentIndex + offset) % playlistTracks.length;
        setCurrentTrack(playlistTracks[nextIndex]);
        setAudioTime(0);
        sendTrackUpdates();
    }

    const handleFadeIn = useCallback(() => {
        if (fading || current.playing || current.volume <= 0) return;
        setFading(true);
        const audio = audioRef.current!;
        audio.volume = 0;
        audio.play();
        sendMessage({ type: "fade", payload: { playlist: props.playlist, fade: "in", duration: fadeTime }});
        setIsPlaying(true, props.playlist);

        const targetVolume = current.volume;
        const interval = 50;
        const steps = fadeTime / interval;

        let currentStep = 0;

        const fadeAudio = setInterval(() => {
            if (currentStep < steps) {
                audio.volume = fadeInVolume(targetVolume, currentStep, steps) * volume;
                currentStep++;
            } else {
                clearInterval(fadeAudio);
                setFading(false);
            }
        }, interval);
    }, [fading, current.playing, current.volume, fadeTime]);

    const handleFadeOut = useCallback(() => {
        if (fading || !current.playing || current.volume <= 0) return;
        
        setFading(true);
        const audio = audioRef.current!;
        sendMessage({ type: "fade", payload: { playlist: props.playlist, fade: "out", duration: fadeTime } });

        const initialVolume = current.volume;
        const interval = 50;
        const steps = fadeTime / interval;

        let currentStep = 0;

        const fadeAudio = setInterval(() => {
            if (currentStep <= steps) {
                audio.volume = fadeOutVolume(initialVolume, currentStep, steps) * volume;
                currentStep++;
            } else {
                audio.pause();
                setIsPlaying(false, props.playlist);
                clearInterval(fadeAudio);
                setFading(false);
            }
        }, interval);
    }, [fading, current.playing, current.volume, fadeTime]);

    useEffect(() => {
        if (scheduledUpdate) {
            setScheduledUpdate(false);
            throttledSend({
                type: "track",
                payload:  {
                    playlist: props.playlist,
                    name: current.track.name,
                    source: current.track.source,
                    time: current.time,
                    volume: current.volume,
                    playing: current.playing,
                }
            });
        }
    }, [scheduledUpdate, throttledSend, current]);

    useEffect(() => {
        const newShuffled = new Map<string, Track[]>();
        for (const playlist of tracks.keys()) {
            newShuffled.set(playlist, shuffleArray([...tracks.get(playlist)!]));
        }
        setShuffled(newShuffled);
    }, [tracks]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (audioElement) {
            const handleTimeUpdate = () => {
                setPlaybackTime(audioElement.currentTime, props.playlist);
            };
            const handleEnded = () => {
                if (current.repeatMode === "no-repeat") {
                    setIsPlaying(false, props.playlist);
                    setAudioTime(0);
                }
                else if (current.repeatMode === "repeat-self") {
                    setAudioTime(0);
                    audioElement.play();
                }
                else {
                    changeTrack(+1);
                }
                sendTrackUpdates();
            }

            audioElement.addEventListener("timeupdate", handleTimeUpdate);
            audioElement.addEventListener("ended", handleEnded);

            return () => {
                audioElement.removeEventListener("timeupdate", handleTimeUpdate);
                audioElement.removeEventListener("ended", handleEnded);
            };
        }
    }, [current.repeatMode, current.shuffle, current.track?.name, tracks]);

    useEffect(() => {
        setLoaded(false, props.playlist);
        setTrackLoaded(false);
    }, [current.track.name]);

    useEffect(() => {
        if (!fading) {
            audioRef.current!.volume = current.volume * volume;
            sendTrackUpdates();
        }
    }, [current.volume, volume, fading])

    useEffect(() => {
        if (loaded && !fading) {
            if (current.playing) {
                audioRef.current!.play();
            }
            else {
                audioRef.current!.pause();
            }
            sendTrackUpdates();
        }
    }, [current.playing, loaded, fading]);

    useEffect(() => {
        if (loaded) {
            console.log("Loaded", props.playlist);
            setDuration(audioRef.current!.duration, props.playlist);
            setPlaybackTime(0, props.playlist);
            sendTrackUpdates();
        }
    }, [loaded]);

    useEffect(() => console.log("Mounted", props.playlist), []);

    useEffect(() => {
        return registerMessageHandler(message => {
            const messageContent = message.message as MessageContent;
            if (messageContent.type === "fade") {
                const payload = messageContent.payload as { fade: "in" | "out", playlist: string };
                if (payload.playlist !== props.playlist) return;
                
                if (payload.fade === "in") {
                    handleFadeIn();
                }
                else if (payload.fade === "out") {
                    handleFadeOut();
                }
            }
        });
    }, [fading, current.playing, current.volume, fadeTime]);
    
    return <div className="track-player-container">
        <audio src={current.track.source} ref={audioRef} onCanPlayThrough={() => { setTrackLoaded(true); setLoaded(true, props.playlist); }} />
        <div className="volume-widget">
            <ReactSlider
                className="volume-slider"
                thumbClassName="volume-slider-thumb"
                trackClassName="volume-slider-track"
                min={0}
                max={100}
                value={(current.volume ?? 0) * 100}
                onChange={value => setVolume(value / 100, props.playlist)}
                orientation="vertical"
                disabled={fading}
                invert
            />
            <FontAwesomeIcon 
                icon={
                    current.volume == 0 
                    ? faVolumeOff 
                    : (current.volume < 0.5)
                    ? faVolumeLow
                    : faVolumeHigh
                } 
                style={{width: "1rem"}}
                className={fading ? "disabled" : undefined}
            />
        </div>
        <div className="track-control-widgets">
            <p className="track-control-display"><span style={{fontWeight: "bold"}}>{ props.playlist }:</span> { current.track.name }</p>
            <div className="track-progressbar-container">
                <p className="text-small unselectable">{formatTime(current.time)}</p>
                <div style={{padding: "0 0.5rem", flex: 1}}>
                    <ReactSlider
                        className="progressbar"
                        thumbClassName="progressbar-thumb"
                        trackClassName="progressbar-track"
                        orientation="horizontal"
                        min={0}
                        max={500}
                        value={current.duration ? (current.time / current.duration * 500) : 0}
                        onChange={value => setAudioTime(value / 500 * current.duration!)}
                    />
                </div>
                <p className="text-small unselectable">{formatTime(current.duration ?? 0)}</p>
            </div>
            <div className="track-bottom-widgets-container">
                <div className="track-playback-controls-container">
                    <img 
                        src={FadeIn}
                        className={`playback-control ${(fading || current.playing) ? "disabled" : "clickable"} unselectable`}
                        onClick={handleFadeIn}
                    />
                    <FontAwesomeIcon
                        icon={faBackward}
                        className={`playback-control ${fading ? "disabled" : "clickable"}`}
                        onClick={() => changeTrack(-1)}
                    />
                    <FontAwesomeIcon 
                        icon={current.playing ? faPause : faPlay} 
                        className={`play-button ${fading ? "disabled" : "clickable"}`}
                        onClick={fading ? undefined : () => setIsPlaying(!current.playing, props.playlist)}
                    />
                    <FontAwesomeIcon
                        icon={faForward}
                        className={`playback-control ${fading ? "disabled" : "clickable"}`}
                        onClick={() => changeTrack(+1)}
                    />
                    <img
                        src={FadeOut}
                        className={`playback-control ${(fading || !current.playing) ? "disabled" : "clickable"} unselectable`}
                        onClick={handleFadeOut}
                    />
                </div>
                <div className="track-playmode-controls-container">
                    <div className="playmode-control">
                        <div 
                            className={`playmode-control-button clickable ${current.repeatMode !== "no-repeat" ? "highlighted" : ""}`}
                            onClick={() => nextRepeatMode()}
                        >
                            {
                                current.repeatMode === "repeat-self" ? 
                                <img src={RepeatSelf} style={{width: "1.1rem"}} className="unselectable" />
                                : <FontAwesomeIcon icon={faRepeat} />
                            }
                        </div>
                    </div>
                    <div className="playmode-control">
                        <div 
                            className={`playmode-control-button clickable ${current.shuffle ? "highlighted" : ""}`}
                            onClick={() => setShuffle(!current.shuffle, props.playlist)}
                        >
                            <FontAwesomeIcon icon={faShuffle} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div 
            className="close-button-container clickable" 
            onClick={() => setCurrentTrack(undefined)}
        >
            <FontAwesomeIcon icon={faClose} />
        </div>
    </div>;
}
