package com.travs.bohol.ui.screens

import android.location.Location
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.zIndex
import coil.compose.AsyncImage
import com.travs.bohol.location.UserLocationProvider
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

internal data class TripStop(
    val id: Long,
    val destinationId: Long,
    val date: LocalDate,
    val time: LocalTime,
    val notes: String? = null
)

private object TripsStore {
    val stops: SnapshotStateList<TripStop> = mutableStateListOf()
    private var nextId = 1L

    fun add(destinationId: Long, date: LocalDate, time: LocalTime, notes: String?) {
        stops.add(TripStop(nextId++, destinationId, date, time, notes?.ifBlank { null }))
    }

    fun update(stop: TripStop) {
        val idx = stops.indexOfFirst { it.id == stop.id }
        if (idx >= 0) stops[idx] = stop
    }

    fun remove(stop: TripStop) {
        stops.removeAll { it.id == stop.id }
    }

    fun move(from: Int, to: Int) {
        if (from !in stops.indices || to !in stops.indices) return
        val item = stops.removeAt(from)
        stops.add(to, item)
    }
}

/** Quick add: uses today + 9:00 AM defaults. User can edit later on the Trips tab. */
internal fun addDestinationToTrip(destinationId: Long) {
    TripsStore.add(destinationId, LocalDate.now(), LocalTime.of(9, 0), null)
}

internal fun isDestinationInTrip(destinationId: Long): Boolean =
    TripsStore.stops.any { it.destinationId == destinationId }

@Composable
fun ItineraryScreen() {
    val stops = TripsStore.stops
    var showingPicker by remember { mutableStateOf(false) }
    var editingStop by remember { mutableStateOf<TripStop?>(null) }

    if (showingPicker) {
        DestinationPickerScreen(
            existingStopDestinationIds = stops.map { it.destinationId }.toSet(),
            onDismiss = { showingPicker = false },
            onConfirm = { selectedIds ->
                selectedIds.forEach { id ->
                    TripsStore.add(id, LocalDate.now(), LocalTime.of(9, 0), null)
                }
                showingPicker = false
            }
        )
        return
    }

    Scaffold(
        floatingActionButton = {
            if (stops.isNotEmpty()) {
                ExtendedFloatingActionButton(
                    onClick = { showingPicker = true },
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("Add stops") }
                )
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(padding)
        ) {
            if (stops.isEmpty()) {
                EmptyTripsState(onAdd = { showingPicker = true })
            } else {
                TripsList(
                    onEdit = { editingStop = it },
                    onRemove = { TripsStore.remove(it) }
                )
            }
        }
    }

    editingStop?.let { stop ->
        DateTimeEditorDialog(
            initial = stop,
            onDismiss = { editingStop = null },
            onSave = { date, time, notes ->
                TripsStore.update(
                    stop.copy(date = date, time = time, notes = notes?.ifBlank { null })
                )
                editingStop = null
            }
        )
    }
}

/* ---------------- Trips list with drag-to-reorder ---------------- */

@Composable
private fun TripsList(
    onEdit: (TripStop) -> Unit,
    onRemove: (TripStop) -> Unit
) {
    val stops = TripsStore.stops
    val distinctDates = stops.map { it.date }.distinct().size

    var draggingIndex by remember { mutableStateOf(-1) }
    var dragOffsetY by remember { mutableStateOf(0f) }
    val itemHeightPx = with(androidx.compose.ui.platform.LocalDensity.current) { 168.dp.toPx() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 24.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item(key = "header") {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("My trip", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Text(
                    "${stops.size} stops · $distinctDates ${if (distinctDates == 1) "day" else "days"}  ·  hold ⋮⋮ to reorder",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        items(stops, key = { it.id }) { stop ->
            val idx = stops.indexOf(stop)
            val destination = previewDestinationById(stop.destinationId) ?: return@items
            val isDragging = idx == draggingIndex

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .zIndex(if (isDragging) 1f else 0f)
                    .graphicsLayer {
                        translationY = if (isDragging) dragOffsetY else 0f
                        scaleX = if (isDragging) 1.02f else 1f
                        scaleY = if (isDragging) 1.02f else 1f
                        alpha = if (isDragging) 0.95f else 1f
                    }
            ) {
                StopCard(
                    index = idx,
                    stop = stop,
                    destination = destination,
                    isDragging = isDragging,
                    onEdit = { onEdit(stop) },
                    onRemove = { onRemove(stop) },
                    dragHandleModifier = Modifier.pointerInput(stop.id) {
                        detectDragGesturesAfterLongPress(
                            onDragStart = {
                                draggingIndex = stops.indexOf(stop)
                                dragOffsetY = 0f
                            },
                            onDragEnd = {
                                draggingIndex = -1
                                dragOffsetY = 0f
                            },
                            onDragCancel = {
                                draggingIndex = -1
                                dragOffsetY = 0f
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                dragOffsetY += dragAmount.y
                                val currentIndex = draggingIndex
                                if (currentIndex < 0) return@detectDragGesturesAfterLongPress
                                if (dragOffsetY > itemHeightPx / 2 && currentIndex < stops.size - 1) {
                                    TripsStore.move(currentIndex, currentIndex + 1)
                                    draggingIndex = currentIndex + 1
                                    dragOffsetY -= itemHeightPx
                                } else if (dragOffsetY < -itemHeightPx / 2 && currentIndex > 0) {
                                    TripsStore.move(currentIndex, currentIndex - 1)
                                    draggingIndex = currentIndex - 1
                                    dragOffsetY += itemHeightPx
                                }
                            }
                        )
                    }
                )
            }
        }
    }
}

@Composable
private fun StopCard(
    index: Int,
    stop: TripStop,
    destination: PreviewDestinationHandle,
    isDragging: Boolean,
    onEdit: () -> Unit,
    onRemove: () -> Unit,
    dragHandleModifier: Modifier
) {
    val elevation by animateFloatAsState(targetValue = if (isDragging) 12f else 1f, label = "elev")
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    modifier = dragHandleModifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.DragHandle,
                        contentDescription = "Drag to reorder",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StopIndexBadge(index + 1)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        destination.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                        Text(
                            destination.municipality,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                IconButton(onClick = onRemove) {
                    Icon(Icons.Default.Close, contentDescription = "Remove", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                InfoPill(icon = Icons.Default.CalendarMonth, text = formatDate(stop.date))
                InfoPill(icon = Icons.Default.Schedule, text = formatTime(stop.time))
            }
            stop.notes?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
            Spacer(Modifier.height(4.dp))
            TextButton(onClick = onEdit, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Edit date & time")
            }
        }
    }
}

@Composable
private fun StopIndexBadge(number: Int) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primary),
        contentAlignment = Alignment.Center
    ) {
        Text(
            "$number",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimary
        )
    }
}

@Composable
private fun InfoPill(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Surface(
        shape = RoundedCornerShape(50),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
            Text(text, style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Composable
private fun EmptyTripsState(onAdd: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.secondaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Default.Explore,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSecondaryContainer,
                modifier = Modifier.size(44.dp)
            )
        }
        Spacer(Modifier.height(20.dp))
        Text(
            "Plan your Bohol trip",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "Pick multiple places to visit, then set the date and time for each stop.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onAdd, shape = RoundedCornerShape(14.dp)) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Add your first stops")
        }
    }
}

/* ---------------- Destination picker (full-screen) ---------------- */

private enum class PickerTab(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    NEAR("Near you", Icons.Default.NearMe),
    POPULAR("Popular", Icons.Default.LocalFireDepartment),
    ALL("All", Icons.Default.Explore)
}

@Composable
private fun DestinationPickerScreen(
    existingStopDestinationIds: Set<Long>,
    onDismiss: () -> Unit,
    onConfirm: (Set<Long>) -> Unit
) {
    val context = LocalContext.current
    val allDestinations = remember { previewDestinationsHandles() }
    val selected = remember { mutableStateListOf<Long>() }
    var query by remember { mutableStateOf("") }
    var tab by remember { mutableStateOf(PickerTab.POPULAR) }

    val locationProvider = remember { UserLocationProvider(context) }
    var userLocation by remember { mutableStateOf<Location?>(null) }

    LaunchedEffect(Unit) {
        if (locationProvider.hasPermission()) userLocation = locationProvider.currentLocation()
    }

    val filtered = remember(query, tab, userLocation, allDestinations) {
        val base = when (tab) {
            PickerTab.NEAR -> {
                val loc = userLocation
                if (loc != null) {
                    allDestinations.sortedBy { distanceKm(loc, it) }
                } else {
                    allDestinations // fallback until we have location
                }
            }
            PickerTab.POPULAR -> allDestinations.sortedByDescending { it.rating.toDoubleOrNull() ?: 0.0 }
            PickerTab.ALL -> allDestinations.sortedBy { it.name }
        }
        if (query.isBlank()) base
        else base.filter {
            it.name.contains(query, ignoreCase = true) ||
                it.municipality.contains(query, ignoreCase = true) ||
                it.category.contains(query, ignoreCase = true)
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            PickerTopBar(
                selectedCount = selected.size,
                onDismiss = onDismiss
            )
        },
        bottomBar = {
            PickerBottomBar(
                selectedCount = selected.size,
                onConfirm = {
                    if (selected.isNotEmpty()) onConfirm(selected.toSet())
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            PickerSearchBar(query = query, onQueryChange = { query = it })
            Spacer(Modifier.height(8.dp))
            PickerTabRow(current = tab, onSelect = { tab = it }, showNearYou = userLocation != null)
            Spacer(Modifier.height(6.dp))
            if (tab == PickerTab.NEAR && userLocation == null) {
                Text(
                    "Turn on location to sort by distance from you. Showing all destinations.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)
                )
            }
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filtered, key = { it.id }) { d ->
                    PickerRow(
                        destination = d,
                        distanceLabel = userLocation?.let { formatKm(distanceKm(it, d)) },
                        alreadyInTrip = d.id in existingStopDestinationIds,
                        selected = d.id in selected,
                        onToggle = {
                            if (d.id in selected) selected.remove(d.id) else selected.add(d.id)
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun PickerTopBar(selectedCount: Int, onDismiss: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, contentDescription = "Close")
            }
            Column(Modifier.weight(1f)) {
                Text("Add stops", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(
                    if (selectedCount == 0) "Tap places you'd like to visit"
                    else "$selectedCount selected",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun PickerBottomBar(selectedCount: Int, onConfirm: () -> Unit) {
    Surface(
        tonalElevation = 3.dp,
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(
                onClick = onConfirm,
                enabled = selectedCount > 0,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text(
                    if (selectedCount == 0) "Select destinations"
                    else "Add $selectedCount ${if (selectedCount == 1) "stop" else "stops"}",
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun PickerSearchBar(query: String, onQueryChange: (String) -> Unit) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        placeholder = { Text("Search by name, place, or category") },
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
        singleLine = true,
        shape = RoundedCornerShape(20.dp)
    )
}

@Composable
private fun PickerTabRow(current: PickerTab, onSelect: (PickerTab) -> Unit, showNearYou: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        PickerTab.values().forEach { t ->
            val isSelected = current == t
            val enabled = t != PickerTab.NEAR || showNearYou
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .clickable(enabled = enabled) { onSelect(t) },
                shape = RoundedCornerShape(12.dp),
                color = if (isSelected) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        t.icon,
                        contentDescription = null,
                        tint = if (isSelected) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        t.label,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isSelected) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}

@Composable
private fun PickerRow(
    destination: PreviewDestinationHandle,
    distanceLabel: String?,
    alreadyInTrip: Boolean,
    selected: Boolean,
    onToggle: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AsyncImage(
                model = destination.imageUrl,
                contentDescription = destination.name,
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(12.dp))
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    destination.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "★ ${destination.rating}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        "· ${destination.category}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(12.dp))
                    Text(
                        destination.municipality,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    distanceLabel?.let {
                        Text(
                            "· $it",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                if (alreadyInTrip) {
                    Text(
                        "Already in your trip",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.secondary,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            SelectableCheck(selected = selected)
        }
    }
}

@Composable
private fun SelectableCheck(selected: Boolean) {
    Box(
        modifier = Modifier
            .size(28.dp)
            .clip(CircleShape)
            .background(
                if (selected) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)
            ),
        contentAlignment = Alignment.Center
    ) {
        if (selected) {
            Icon(
                Icons.Default.Check,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

/* ---------------- Date/time editor ---------------- */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateTimeEditorDialog(
    initial: TripStop,
    onDismiss: () -> Unit,
    onSave: (date: LocalDate, time: LocalTime, notes: String?) -> Unit
) {
    var date by remember { mutableStateOf(initial.date) }
    var time by remember { mutableStateOf(initial.time) }
    var notes by remember { mutableStateOf(initial.notes ?: "") }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    val destination = previewDestinationById(initial.destinationId)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Edit stop", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        destination?.let {
                            Text(it.name, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        }
                    }
                    IconButton(onClick = onDismiss) { Icon(Icons.Default.Close, contentDescription = "Close") }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PickerField(
                        modifier = Modifier.weight(1f),
                        label = "Date",
                        value = formatDate(date),
                        icon = Icons.Default.CalendarMonth,
                        onClick = { showDatePicker = true }
                    )
                    PickerField(
                        modifier = Modifier.weight(1f),
                        label = "Time",
                        value = formatTime(time),
                        icon = Icons.Default.Schedule,
                        onClick = { showTimePicker = true }
                    )
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 4
                )

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(Modifier.width(8.dp))
                    Button(onClick = { onSave(date, time, notes) }) { Text("Save") }
                }
            }
        }
    }

    if (showDatePicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let {
                        date = java.time.Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).toLocalDate()
                    }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Cancel") } }
        ) { DatePicker(state = state) }
    }

    if (showTimePicker) {
        val timeState = rememberTimePickerState(initialHour = time.hour, initialMinute = time.minute, is24Hour = false)
        Dialog(onDismissRequest = { showTimePicker = false }) {
            Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface) {
                Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Pick a time", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(16.dp))
                    TimePicker(state = timeState)
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
                        Spacer(Modifier.width(4.dp))
                        TextButton(onClick = {
                            time = LocalTime.of(timeState.hour, timeState.minute)
                            showTimePicker = false
                        }) { Text("OK") }
                    }
                }
            }
        }
    }
}

@Composable
private fun PickerField(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Column {
                Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            }
        }
    }
}

/* ---------------- Utils ---------------- */

private fun distanceKm(from: Location, dest: PreviewDestinationHandle): Double {
    val out = FloatArray(1)
    Location.distanceBetween(from.latitude, from.longitude, dest.latitude, dest.longitude, out)
    return out[0] / 1000.0
}

private fun formatKm(km: Double): String = when {
    km < 1.0 -> "${(km * 1000).toInt()} m"
    km < 10.0 -> String.format("%.1f km", km)
    else -> "${km.toInt()} km"
}

private fun formatDate(date: LocalDate): String =
    date.format(DateTimeFormatter.ofPattern("EEE, MMM d"))

private fun formatTime(time: LocalTime): String =
    time.format(DateTimeFormatter.ofPattern("h:mm a"))
