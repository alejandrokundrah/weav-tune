package com.weavtune.ui.library

import android.graphics.Bitmap
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.assertIsEnabled
import com.weavtune.data.download.Downloads
import com.weavtune.data.download.DownloadEntry
import com.weavtune.data.download.DownloadState
import com.weavtune.data.library.SongRef
import org.junit.Assert.assertEquals
import androidx.test.core.app.ApplicationProvider
import com.weavtune.data.history.History
import com.weavtune.data.library.LibraryStore
import com.weavtune.data.model.Song
import com.weavtune.data.settings.AppSettings
import com.weavtune.data.settings.ThemeSettings
import com.weavtune.ui.browse.SongActions
import com.weavtune.ui.theme.WeavTuneTheme
import java.io.File
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** A phone playlist with Add songs and Download all, and the Add songs sheet, to build/screenshots/playlist. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w411dp-h891dp-xxhdpi", application = android.app.Application::class)
class PlaylistToolsScreenshotTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private lateinit var id: String
    private val songs = listOf(
        Song("aaaaaaaaaaa", "Husn", "Anuv Jain", null, "3:38"),
        Song("bbbbbbbbbbb", "Kesariya", "Arijit Singh", null, "4:28"),
        Song("ccccccccccc", "Blinding Lights", "The Weeknd", null, "3:20"),
    )

    @Before fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.app.Application>()
        AppSettings.init(context)
        // Glass now matches the account playlist page. Robolectric's software
        // screenshot canvas cannot draw RuntimeShader; exercise its reduced-blur layout.
        AppSettings.updateUi { it.copy(reduceBlur = true) }
        LibraryStore.init(context)
        id = LibraryStore.createPlaylist("Late nights")
        LibraryStore.addAllToPlaylist(id, songs.take(2))
        songs.forEach { History.record(it, 200_000) }
    }

    @Test fun page() = shoot("playlist/page") { LocalPlaylistScreen(id, PaddingValues(), SongActions(null, false, { _, _, _, _ -> }, {}, {}), onBack = {}) }

    @Test fun spotifyUsesTheSamePlaylistLayout() {
        LibraryStore.putSpotifyPlaylist("1234567890123456789012", "Late nights", songs, "revision", null)
        val spotify = LibraryStore.playlists.value.first { it.spotifyId != null }
        shoot("playlist/spotify") { LocalPlaylistScreen(spotify.id, PaddingValues(), SongActions(null, false, { _, _, _, _ -> }, {}, {}), onBack = {}) }
        compose.onNodeWithText("Spotify").assertExists()
        compose.onNodeWithText("Search this list").assertDoesNotExist()
        compose.onNodeWithContentDescription("Add songs").assertDoesNotExist()
        compose.onNodeWithContentDescription("More").performClick()
        compose.onNodeWithText("Add songs").assertDoesNotExist()
    }

    @Test fun spotifyPlaylistsAreNotOfferedAsWriteTargets() {
        LibraryStore.putSpotifyPlaylist("1234567890123456789012", "Spotify collection", songs, "revision", null)
        compose.setContent { WeavTuneTheme(ThemeSettings()) {
            com.weavtune.ui.components.AddToPlaylistDialog(songs.last(), onDone = {}, onDismiss = {})
        } }
        compose.onNodeWithText("Spotify collection").assertDoesNotExist()
        compose.onNodeWithText("Late nights").assertExists()
    }

    @Test fun addSheet() = shoot("playlist/add") { AddSongsSheet(id, onDismiss = {}) }

    @Test fun completedPlaylistCanOpenRemovalAndKeepItsDownloads() {
        Downloads.init(ApplicationProvider.getApplicationContext())
        songs.forEach { song -> Downloads.put(song.videoId) { DownloadEntry(SongRef.of(song), DownloadState.DONE) } }
        shoot("playlist/download-management") { DownloadAllButton(songs) }
        compose.onNodeWithText("Downloaded · Manage").assertIsEnabled().performClick()
        compose.onNodeWithText("Remove all downloads").performClick()
        compose.onNodeWithText("Remove playlist downloads?").assertExists()
        compose.onNodeWithText("Keep downloads").performClick()
        assertEquals(3, songs.count { Downloads.entryNow(it.videoId)?.state == DownloadState.DONE })
    }

    @Test fun inProgressPlaylistOffersCancelAndRemoveSeparately() {
        Downloads.init(ApplicationProvider.getApplicationContext())
        Downloads.put(songs[0].videoId) { DownloadEntry(SongRef.of(songs[0]), DownloadState.DONE) }
        Downloads.put(songs[1].videoId) { DownloadEntry(SongRef.of(songs[1]), DownloadState.DOWNLOADING) }
        shoot("playlist/download-progress") { DownloadAllButton(songs) }
        compose.onNodeWithText("Downloading · 1/3").performClick()
        compose.onNodeWithText("Cancel downloads").assertExists()
        compose.onNodeWithText("Remove all downloads").assertExists()
        compose.onNodeWithText("Download remaining songs").assertExists()
    }

    private fun shoot(name: String, content: @androidx.compose.runtime.Composable () -> Unit) {
        compose.setContent { WeavTuneTheme(ThemeSettings()) { Surface(color = MaterialTheme.colorScheme.background) { content() } } }
        compose.mainClock.advanceTimeBy(2_000)
        compose.waitForIdle()
        // The sheet is a dialog window of its own; draw the topmost window.
        val view = org.robolectric.shadows.ShadowDialog.getLatestDialog()?.window?.decorView ?: compose.activity.window.decorView
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        view.draw(android.graphics.Canvas(bitmap))
        val file = File("build/screenshots/$name.png").apply { parentFile!!.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
