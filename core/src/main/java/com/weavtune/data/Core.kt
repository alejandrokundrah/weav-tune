package com.weavtune.data

import android.app.Application
import com.weavtune.data.account.AccountStore
import com.weavtune.data.autoeq.AutoEq
import com.weavtune.data.covers.AlbumCovers
import com.weavtune.data.download.Downloads
import com.weavtune.data.history.History
import com.weavtune.data.innertube.InnerTubeXResolver
import com.weavtune.data.innertube.UpgradedTracks
import com.weavtune.data.lastfm.LastFm
import com.weavtune.data.library.LibraryStore
import com.weavtune.data.listenbrainz.ListenBrainz
import com.weavtune.data.settings.AppSettings
import com.weavtune.data.subsonic.Subsonic
import com.weavtune.playback.QueueStore

/** Starts the shared services, in the order they depend on each other. */
object Core {
    /**
     * [phone] is false on the watch, which leaves out what only the phone
     * and TV app does: new-release alerts, update checks and usage counts.
     */
    @androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
    fun init(app: Application, phone: Boolean = true) {
        // Media3's warnings and errors (a failed load, a decoder that won't
        // start) into the app's own log as well as logcat, for "Copy log".
        androidx.media3.common.util.Log.setLogger(object : androidx.media3.common.util.Log.Logger {
            private val system = androidx.media3.common.util.Log.Logger.DEFAULT
            override fun d(tag: String, message: String, throwable: Throwable?) = system.d(tag, message, throwable)
            override fun i(tag: String, message: String, throwable: Throwable?) = system.i(tag, message, throwable)
            override fun w(tag: String, message: String, throwable: Throwable?) {
                AppLog.add('W', tag, message, throwable)
                system.w(tag, message, throwable)
            }
            override fun e(tag: String, message: String, throwable: Throwable?) {
                AppLog.add('E', tag, message, throwable)
                system.e(tag, message, throwable)
            }
        })
        AppSettings.init(app)
        com.weavtune.data.config.RemoteConfig.init(app)
        com.weavtune.data.addons.AddonStore.init(app)
        com.weavtune.data.addons.AddonOutput.init(app)
        com.weavtune.data.addons.AddonStore.onChanged = com.weavtune.data.lossless.ExternalStreams::retryLookups
        History.init(app)
        com.weavtune.data.history.ListenedCollections.init(app)
        com.weavtune.data.covers.ArtistPhotos.init(app)
        LoudnessStore.init(app)
        UpgradedTracks.init(app)
        QueueStore.init(app)
        com.weavtune.data.together.Together.init(app)
        LastFm.init(app)
        Subsonic.init(app)
        ListenBrainz.init(app)
        com.weavtune.data.radio.Radio.init(app)
        if (phone) {
            com.weavtune.data.addons.AddonRefreshWorker.schedule(app)
            com.weavtune.data.releases.NewReleases.init(app)
            com.weavtune.data.UpdateCheck.init(app)
            com.weavtune.data.UpdateLock.init(app)
            com.weavtune.data.UpdateCheck.schedule(app)
            com.weavtune.data.Usage.init(app)
        }
        // Spotify sign-in is gone; drop any tokens an earlier version kept.
        app.deleteSharedPreferences("spotify")
        // The waveform seek bar is gone; drop the waveforms an earlier version saved.
        java.io.File(app.filesDir, "waveforms").takeIf { it.exists() }?.let { dir -> Thread { dir.deleteRecursively() }.start() }
        com.weavtune.data.podcasts.Podcasts.init(app)
        com.weavtune.data.library.ResumePoints.init(app)
        AlbumCovers.init(app)
        com.weavtune.data.spotify.SpotifyWebPlayer.init(app)
        com.weavtune.data.spotify.SpotifySync.init(app)
        AutoEq.init(app)
        com.weavtune.data.library.LibraryArtwork.init(app)
        LibraryStore.init(app)
        Downloads.init(app)
        com.weavtune.data.download.DownloadedLists.init(app)
        AccountStore.init(app)
        com.weavtune.data.library.LibraryCache.init(app)
        // After library and account: it sends playlist changes still waiting, when signed in.
        com.weavtune.data.library.PlaylistSync.init(app)
        InnerTubeXResolver.init(app)
    }

    /**
     * Saves at once what's still waiting for its save (each store waits a moment
     * after a change, so a run of changes is written once): the app is leaving
     * the screen or the player is closing, and the process may go any moment.
     */
    fun flush() {
        LibraryStore.flush()
        History.flush()
        com.weavtune.data.history.ListenedCollections.flush()
        Downloads.flush()
    }
}
