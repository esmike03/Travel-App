package com.travs.bohol.update

import com.travs.bohol.data.remote.AppApi
import com.travs.bohol.data.remote.LatestVersionResponse

class UpdateChecker(private val api: AppApi) {

    /**
     * Returns the latest release if it is newer than [currentVersionCode],
     * or null when the app is up to date / the check fails.
     */
    suspend fun checkForUpdate(currentVersionCode: Int): LatestVersionResponse? {
        val latest = runCatching { api.latestVersion() }.getOrNull() ?: return null
        return latest.takeIf { it.versionCode > currentVersionCode }
    }
}
