package com.weavtune.ui.browse

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.weavtune.data.Collection
import com.weavtune.data.DebugLog
import com.weavtune.data.account.AccountStore
import com.weavtune.data.innertube.Innertube
import com.weavtune.data.model.PlaylistPrivacy
import com.weavtune.ui.components.PrivacySheet
import com.weavtune.ui.components.PrivateShareDialog
import com.weavtune.ui.share.ListShare
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The owner's controls for one of the account's own playlists on YouTube
 * Music, made there or elsewhere: who can see it, and sharing its link with
 * that in mind. A playlist with a copy here is changed through that instead;
 * see [com.weavtune.ui.library.LocalPlaylistScreen].
 */
internal class OwnPlaylist(
    /** Null when the page didn't say. */
    val privacy: PlaylistPrivacy?,
    val choose: () -> Unit,
    val share: () -> Unit,
)

/** [OwnPlaylist] for [c], or null when it isn't the signed-in account's own. */
@Composable
internal fun rememberOwnPlaylist(c: Collection): OwnPlaylist? {
    val signedIn by AccountStore.signedIn.collectAsState()
    if (!signedIn || c.owned != true) return null
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var privacy by remember(c.browseId, c.privacy) { mutableStateOf(c.privacy) }
    var choosing by remember { mutableStateOf(false) }
    var privateShare by remember { mutableStateOf(false) }
    val shareNow = { ListShare.sharePlaylist(context, c.title, c.browseId, ListShare.coversFor(c.thumbnailUrl, c.songs), ListShare.countLine(c.songs.size)) }
    // Shown as changed at once, and put back if YouTube Music says no.
    val change: (PlaylistPrivacy, () -> Unit) -> Unit = { to, then ->
        val before = privacy
        privacy = to
        scope.launch {
            try {
                withContext(Dispatchers.IO) { Innertube.setPlaylistPrivacy(c.browseId, to) }
                then()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                DebugLog.w("OwnPlaylist", "Couldn't make ${c.browseId} ${to.apiValue}", e)
                privacy = before
                com.weavtune.data.Pills.error("Couldn't change who can see it", context)
            }
        }
    }
    if (choosing) PrivacySheet(privacy, { if (it != privacy) change(it) {} }, onDismiss = { choosing = false })
    if (privateShare) PrivateShareDialog(
        onMakePublic = { privateShare = false; change(PlaylistPrivacy.PUBLIC, shareNow) },
        onShareAnyway = { privateShare = false; shareNow() },
        onDismiss = { privateShare = false },
    )
    return OwnPlaylist(
        privacy = privacy,
        choose = { choosing = true },
        // Unknown is shared as it is: the page just didn't say.
        share = { if (privacy == PlaylistPrivacy.PRIVATE) privateShare = true else shareNow() },
    )
}
