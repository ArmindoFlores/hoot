# <img src="https://raw.githubusercontent.com/ArmindoFlores/hoot/main/public/icon.svg" width="40"> Hoot

Hoot is an [Owlbear Rodeo](https://owlbear.rodeo) extension that adds a music library and an audio player controlled by the GM and where tracks are played to the whole party. It provides volume controls for all players, and a lot more detailed options for the GM.

## Functionality
### Tracks & Playlists
Hoot organizes your music in tracks and playlists. A playlist is simply a list of tracks, and it is useful, for example, if you want Hoot to automatically start playing another track when the current finishes. You also have access to shuffle mode and repeating mode, which plays you tracks in a random order or repeats the same track over and over, respectively.

### Multiple Tracks
Hoot allows you to play any number of tracks simultaneously, as long as they're from different playlists. This can be useful if you have a set of ambient sounds, for example, but also want to play some calming music. You can control each track's volume, repeating and shuffle mode, autoplay, and other properties individually. Additionally, there is a global volume slider that is applied after the individual volumes have been taken into account.

### Effects
Hoot supports fading in and fading out tracks for seemless transitions. In the future, it might also be possible to control fading time and other parameters.

### Import / Export
Hoot allows you to import a track list from a JSON file. The following is an example:

```json
[
    {
        "name": "Track 1",
        "source": "https://mysource.com/path/to/track1.mp3",
        "playlists": ["Ambient"]
    },
    ...
]
```

You can also add and remove tracks without having to import them from a file through the same menu. You can export all your tracks to this same format.


## Limitations
### Storage
For legal reasons, Hoot cannot store your music, and it doesn't support other services like Spotify or Youtube. Thus, you must either host the tracks yourself, point them to a public file, or use a service such as Dropbox.

### Autoplay
Modern browsers have measures against autoplaying media such as videos and audio to enhance their user experience. Unfortunately, that means you might need to go through some extra steps before Hoot can play audio for you. This can all be avoided if Owlbear is installed as a [PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps).
