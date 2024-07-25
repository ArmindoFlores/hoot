import { faBackward, faForward, faPause, faPlay, faRepeat, faShuffle, faVolumeHigh, faVolumeLow, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useMemo, useRef, useState } from "react";

import FadeIn from "../assets/fadein.svg";
import FadeOut from "../assets/fadeout.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ReactSlider from "react-slider";
import { useAudioPlayer } from "./AudioPlayerProvider";

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

export function AudioControls(props: AudioControlsProps) {
    const { volume, playing, setVolume, setPlaybackTime, setDuration, setShuffle, setIsPlaying } = useAudioPlayer();
    const current = useMemo(() => playing[props.playlist], [playing]);

    const audioRef = useRef<HTMLAudioElement>(null);

    const [ loaded, setLoaded ] = useState(false);

    const setAudioTime = (time: number) => {
        const audioElement = audioRef.current;
        if (audioElement) {
            audioRef.current.currentTime = time;
            setPlaybackTime(audioElement.currentTime, props.playlist);
        }
    }

    useEffect(() => {
        const audioElement = audioRef.current;
        if (audioElement) {
            const handleTimeUpdate = () => {
                setPlaybackTime(audioElement.currentTime, props.playlist);
            };
            audioElement.addEventListener("timeupdate", handleTimeUpdate);

            return () => {
                audioElement.removeEventListener("timeupdate", handleTimeUpdate);
            };
        }
    }, []);

    useEffect(() => {
        setLoaded(false);
    }, [current.track.name]);

    useEffect(() => {
        audioRef.current!.volume = current.volume * volume;
    }, [current.volume, volume])

    useEffect(() => {
        if (current.playing) {
            audioRef.current!.play();
        }
        else {
            audioRef.current!.pause();
        }
    }, [current.playing]);

    useEffect(() => {
        if (loaded) {
            setDuration(audioRef.current!.duration, props.playlist);
            setPlaybackTime(audioRef.current!.duration / 2, props.playlist);
        }
    }, [loaded])
    
    return <div className="track-player-container">
        <audio src={current.track.source} ref={audioRef} onCanPlayThrough={() => setLoaded(true)} />
        <div className="volume-widget">
            <ReactSlider
                className="volume-slider"
                thumbClassName="volume-slider-thumb"
                trackClassName="volume-slider-track"
                min={0}
                max={100}
                value={current.volume * 100}
                onChange={value => setVolume(value / 100, props.playlist)}
                orientation="vertical"
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
                    <img src={FadeIn} className="playback-control clickable unselectable" />
                    <FontAwesomeIcon icon={faBackward} className="playback-control clickable" />
                    <FontAwesomeIcon 
                        icon={current.playing ? faPause : faPlay} 
                        className="play-button clickable" 
                        onClick={() => setIsPlaying(!current.playing, props.playlist)}
                    />
                    <FontAwesomeIcon icon={faForward} className="playback-control clickable" />
                    <img src={FadeOut} className="playback-control clickable unselectable" />
                </div>
                <div className="track-playmode-controls-container">
                    <div className="playmode-control">
                        <div className="playmode-control-button clickable">
                            <FontAwesomeIcon icon={faRepeat} />
                        </div>
                    </div>
                    <div className="playmode-control">
                        <div 
                            className={"playmode-control-button clickable" + (current.shuffle ? " highlighted" : "")}
                            onClick={() => setShuffle(!current.shuffle, props.playlist)}
                        >
                            <FontAwesomeIcon icon={faShuffle} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>;
}
