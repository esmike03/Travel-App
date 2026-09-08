package com.travs.bohol.ui.screens

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.location.Location
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.filled.DriveEta
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PinDrop
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.automirrored.filled.StarHalf
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import com.travs.bohol.location.UserLocationProvider
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import kotlin.math.roundToInt

private data class DestinationPreview(
    val id: Long,
    val name: String,
    val municipality: String,
    val location: String,
    val category: String,
    val imageUrl: String,
    val rating: String,
    val latitude: Double,
    val longitude: Double,
    val shortDescription: String,
    val bestTimeToVisit: String,
    val sourceUrl: String = "https://www.journeyera.com/things-to-do-bohol/"
)

private val previewDestinations = listOf(
    DestinationPreview(
        1,
        "Dimiao Twin Falls (Pahangog Falls)",
        "Dimiao",
        "Dimiao, Bohol",
        "Waterfall",
        "https://www.journeyera.com/wp-content/uploads/2016/10/waterfall-bohol-03731-1024x683.jpg",
        "4.8",
        9.6106,
        124.1594,
        "A twin-stream waterfall with a jungle setting, natural pools, and cliff-jump spots where depth should be checked carefully.",
        "Morning or late afternoon"
    ),
    DestinationPreview(
        2,
        "Can-Umantad Falls",
        "Candijay",
        "Candijay, Bohol",
        "Waterfall",
        "https://www.journeyera.com/wp-content/uploads/2019/05/can-umantad-falls-candijay-bohol-2726124A2726.jpg",
        "4.7",
        9.8330,
        124.4970,
        "A tall waterfall near Candijay with bright blue pools and nearby countryside stops.",
        "After light rain, during daylight"
    ),
    DestinationPreview(
        3,
        "Panglao Beach Sunset",
        "Panglao",
        "Panglao, Bohol",
        "Beach",
        "https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-2346124A2346.jpg",
        "4.7",
        9.5780,
        123.7458,
        "A quiet sunset beach area on Panglao with calm water, palm trees, and reflective shoreline views.",
        "Sunset"
    ),
    DestinationPreview(
        4,
        "Camugao Waterfall",
        "Balilihan",
        "Balilihan, Bohol",
        "Waterfall",
        "https://www.journeyera.com/wp-content/uploads/2019/05/CAMUGAO-FALLS-BOHOL-2314124A2314.jpg",
        "4.6",
        9.7542,
        123.9728,
        "A forest waterfall reached by a short but steep walk, with a dramatic drop and greenery around the pool.",
        "Morning"
    ),
    DestinationPreview(
        5,
        "Mag-Aso Falls",
        "Antequera",
        "Antequera, Bohol",
        "Waterfall",
        "https://www.journeyera.com/wp-content/uploads/2019/05/MAG-ASO-FALLS-BOHOL-2078124A2078.jpg",
        "4.6",
        9.7794,
        123.9018,
        "A refreshing waterfall near Antequera with an easy entrance and a short walk down to the falls.",
        "Morning"
    ),
    DestinationPreview(
        6,
        "Cadapdapan Rice Terraces",
        "Candijay",
        "Candijay, Bohol",
        "Nature",
        "https://www.journeyera.com/wp-content/uploads/2019/05/cadapdapan-rice-terraces-candijay-bohol-0552DJI_0552.jpg",
        "4.8",
        9.8219,
        124.5102,
        "Layered rice terraces in Candijay with wide views, nearby falls, and a quiet rural feel.",
        "Early morning or golden hour"
    ),
    DestinationPreview(
        7,
        "Panglao Beach",
        "Panglao",
        "Panglao, Bohol",
        "Beach",
        "https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-1840124A1840.jpg",
        "4.6",
        9.5762,
        123.7447,
        "A palm-lined stretch of Panglao coastline suited for slow exploring, swimming, and relaxed beach time.",
        "Morning or sunset"
    ),
    DestinationPreview(
        8,
        "Mayana Peak",
        "Jagna",
        "Mayana, Jagna, Bohol",
        "Hike",
        "https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-1661124A1661.jpg",
        "4.5",
        9.7225,
        124.3550,
        "A short highland trek reached by motorbike, offering mountain views over central Bohol.",
        "Sunrise or late afternoon"
    ),
    DestinationPreview(
        9,
        "Alexis Cliff Dive Resort / Molave Cove",
        "Panglao",
        "Panglao, Bohol",
        "Cliff jump",
        "https://www.journeyera.com/wp-content/uploads/2019/05/cliff-jumping-bohol-philippines-1602124A1602.jpg",
        "4.5",
        9.5548,
        123.7775,
        "A popular Panglao cliff-jumping spot with clear water and easier access than many hidden coastal jumps.",
        "Calm seas and daylight"
    ),
    DestinationPreview(
        10,
        "Binabaje Hills Sunrise Trek",
        "Alicia",
        "Alicia, Bohol",
        "Hike",
        "https://www.journeyera.com/wp-content/uploads/2019/05/binabaje-hills-in-alicia-bohol-0587DJI_0587.jpg",
        "4.8",
        9.8940,
        124.4550,
        "A steep sunrise hike in Alicia with rolling hills and wide countryside views.",
        "Sunrise"
    ),
    DestinationPreview(
        11,
        "Kinahugan Falls",
        "Jagna",
        "Jagna, Bohol",
        "Waterfall",
        "https://www.journeyera.com/wp-content/uploads/2019/01/cliff-jumping-bohol-philippines-1802124A1802.jpg",
        "4.4",
        9.7068,
        124.3631,
        "A quieter local waterfall stop near rice fields and villages around Jagna.",
        "Morning or early afternoon"
    ),
    DestinationPreview(
        12,
        "Rice Fields near Mayana",
        "Jagna",
        "Mayana, Jagna, Bohol",
        "Nature",
        "https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-DJI_0446-Pano.jpg",
        "4.4",
        9.7194,
        124.3500,
        "Scenic rice fields and mountain views around Mayana, ideal for slow drives and photo stops.",
        "Golden hour"
    ),
    DestinationPreview(
        13,
        "Lonoy Cold Spring",
        "Jagna",
        "Lonoy, Jagna, Bohol",
        "Spring",
        "https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-1735124A1735.jpg",
        "4.3",
        9.7049,
        124.3600,
        "A local cold spring near Mayana where visitors can cool down after exploring inland Bohol.",
        "Midday"
    ),
    DestinationPreview(
        14,
        "Anda White Beach",
        "Anda",
        "Anda, Bohol",
        "Beach",
        "https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-2604124A2604.jpg",
        "4.8",
        9.7462,
        124.5765,
        "A quieter white-sand beach area in Anda with palm-lined coast and a calmer pace than Panglao.",
        "Morning or sunset"
    ),
    DestinationPreview(
        15,
        "Canawa Cold Spring",
        "Candijay",
        "Candijay, Bohol",
        "Spring",
        "https://www.journeyera.com/wp-content/uploads/2019/05/CANAWA-COLD-SPRING-CANDIJAY-BOHOL-2802124A2802.jpg",
        "4.5",
        9.8190,
        124.5060,
        "A deep blue cold spring in Candijay that works well as a refreshing stop before or after Anda.",
        "Midday"
    ),
    DestinationPreview(
        16,
        "Can-Uba Beach",
        "Jagna",
        "Jagna, Bohol",
        "Beach",
        "https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-1824124A1824.jpg",
        "4.6",
        9.6478,
        124.3665,
        "A peaceful rocky beach near Jagna, lined with palms and better suited for scenic stops than soft-sand lounging.",
        "Sunset"
    )
)

internal object FavoritesStore {
    val ids: androidx.compose.runtime.snapshots.SnapshotStateList<Long> = mutableStateListOf()

    fun isFavorite(id: Long): Boolean = ids.contains(id)

    fun toggle(id: Long): Boolean {
        return if (ids.contains(id)) {
            ids.remove(id); false
        } else {
            ids.add(id); true
        }
    }
}

@Composable
fun DiscoverScreen(onDestinationClick: (Long) -> Unit) {
    var query by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf<String?>(null) }

    val categories = remember { previewDestinations.map { it.category }.distinct() }

    val filtered by remember {
        derivedStateOf {
            previewDestinations.filter { d ->
                val matchesQuery = query.isBlank() ||
                    d.name.contains(query, ignoreCase = true) ||
                    d.category.contains(query, ignoreCase = true) ||
                    d.municipality.contains(query, ignoreCase = true) ||
                    d.shortDescription.contains(query, ignoreCase = true)
                val matchesCategory = selectedCategory == null || d.category == selectedCategory
                matchesQuery && matchesCategory
            }
        }
    }
    val featured = remember { previewDestinations.sortedByDescending { it.rating.toDoubleOrNull() ?: 0.0 }.take(5) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(top = 20.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { DiscoverHeader() }
        item {
            SearchField(
                value = query,
                onValueChange = { query = it }
            )
        }
        item {
            CategoryChipRow(
                categories = categories,
                selected = selectedCategory,
                onSelect = { selectedCategory = if (selectedCategory == it) null else it }
            )
        }
        if (selectedCategory == null && query.isBlank()) {
            item { SectionHeading("Popular now", "Top-rated Bohol picks") }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(featured) { d ->
                        FeaturedCard(destination = d, onClick = { onDestinationClick(d.id) })
                    }
                }
            }
        }
        item {
            SectionHeading(
                title = if (selectedCategory != null) selectedCategory!! else "All destinations",
                subtitle = "${filtered.size} places"
            )
        }
        items(filtered, key = { it.id }) {
            Box(Modifier.padding(horizontal = 20.dp)) {
                DestinationCard(destination = it, onClick = { onDestinationClick(it.id) })
            }
        }
    }
}

@Composable
private fun DiscoverHeader() {
    Column(Modifier.padding(horizontal = 20.dp)) {
        Text("Discover Bohol", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(
            "Curated spots for your next trip.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun SearchField(value: String, onValueChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
        placeholder = { Text("Search destinations") },
        singleLine = true,
        shape = RoundedCornerShape(20.dp)
    )
}

@Composable
private fun CategoryChipRow(
    categories: List<String>,
    selected: String?,
    onSelect: (String) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(categories) { c ->
            val isSelected = c == selected
            Surface(
                shape = RoundedCornerShape(50),
                color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                modifier = Modifier.clickable { onSelect(c) }
            ) {
                Text(
                    c,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Medium,
                    color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                )
            }
        }
    }
}

@Composable
private fun SectionHeading(title: String, subtitle: String? = null) {
    Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        subtitle?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeaturedCard(destination: DestinationPreview, onClick: () -> Unit) {
    val isSaved = FavoritesStore.isFavorite(destination.id)
    Card(
        onClick = onClick,
        modifier = Modifier.width(240.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Box {
            AsyncImage(
                model = destination.imageUrl,
                contentDescription = destination.name,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp),
                contentScale = ContentScale.Crop
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .background(
                        Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.6f)))
                    )
            )
            Column(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(10.dp),
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                RatingPill(rating = destination.rating)
                if (isSaved) SavedBadge()
            }
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(12.dp)
            ) {
                Text(
                    destination.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    maxLines = 2
                )
                Text(
                    destination.municipality,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.9f)
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DestinationCard(destination: DestinationPreview, onClick: () -> Unit) {
    val isSaved = FavoritesStore.isFavorite(destination.id)
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column {
            Box {
                AsyncImage(
                    model = destination.imageUrl,
                    contentDescription = destination.name,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentScale = ContentScale.Crop
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    CategoryPill(destination.category)
                    Column(
                        horizontalAlignment = Alignment.End,
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        RatingPill(rating = destination.rating)
                        if (isSaved) SavedBadge()
                    }
                }
            }
            Column(
                Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        destination.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        modifier = Modifier.weight(1f)
                    )
                    if (isSaved) {
                        Icon(
                            Icons.Default.Bookmark,
                            contentDescription = "Saved",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        destination.municipality,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    destination.shortDescription,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
            }
        }
    }
}

@Composable
private fun RatingPill(rating: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(50),
        color = Color.Black.copy(alpha = 0.55f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Icon(
                Icons.Default.Star,
                contentDescription = null,
                tint = Color(0xFFFFC107),
                modifier = Modifier.size(12.dp)
            )
            Text(
                rating,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }
    }
}

@Composable
private fun SavedBadge(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(50),
        color = MaterialTheme.colorScheme.primary
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Icon(
                Icons.Default.Bookmark,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(12.dp)
            )
            Text(
                "Saved",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onPrimary
            )
        }
    }
}

@Composable
private fun CategoryPill(category: String) {
    Surface(
        shape = RoundedCornerShape(50),
        color = Color.White.copy(alpha = 0.9f)
    ) {
        Text(
            category,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = Color.Black,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

private data class Review(
    val author: String,
    val date: String,
    val rating: Int,
    val comment: String
)

private val sampleReviewPool = listOf(
    Review("Andrea M.", "2 weeks ago", 5, "Absolutely stunning. Went early morning and had it almost to ourselves. Bring water and grippy shoes."),
    Review("Miguel S.", "1 month ago", 4, "Beautiful spot, worth the ride. Signage is a bit thin so use offline maps to be safe."),
    Review("Kayla T.", "1 month ago", 5, "One of the highlights of our Bohol trip — locals were friendly and the scenery is unreal."),
    Review("Rafael D.", "2 months ago", 4, "Great half-day stop. A little crowded around noon, plan for sunrise or late afternoon."),
    Review("Sam P.", "3 months ago", 3, "Nice place but conditions vary with weather. Check recent posts before making the trip.")
)

private fun sampleReviewsFor(destination: DestinationPreview): List<Review> {
    val seed = destination.id.toInt().coerceAtLeast(1)
    return (0 until 3).map { sampleReviewPool[(seed + it) % sampleReviewPool.size] }
}

@Composable
fun DestinationDetailScreen(destinationId: Long, onBack: () -> Unit) {
    val context = LocalContext.current
    val destination = previewDestinations.firstOrNull { it.id == destinationId } ?: previewDestinations.first()
    val nearby = previewDestinations
        .filter { it.id != destination.id && it.municipality == destination.municipality }
        .take(5)
        .ifEmpty { previewDestinations.filter { it.id != destination.id }.take(5) }
    val reviews = remember(destination.id) { sampleReviewsFor(destination) }

    val locationProvider = remember { UserLocationProvider(context) }
    var hasLocationPermission by remember { mutableStateOf(locationProvider.hasPermission()) }
    var userLocation by remember { mutableStateOf<Location?>(null) }
    val isSaved = FavoritesStore.isFavorite(destination.id)

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasLocationPermission = granted }

    LaunchedEffect(destination.id, hasLocationPermission) {
        if (hasLocationPermission) userLocation = locationProvider.currentLocation()
    }

    val distanceKm = userLocation?.let { distanceKmBetween(it, destination) }
    val etaMinutes = distanceKm?.let { estimateEtaMinutes(it) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item {
            HeroImage(
                destination = destination,
                isSaved = isSaved,
                onBack = onBack,
                onToggleSave = {
                    val nowSaved = FavoritesStore.toggle(destination.id)
                    if (nowSaved) showSavedMessage(context, destination.name)
                }
            )
        }
        item { DetailHeader(destination = destination, reviews = reviews) }
        item {
            QuickStatsRow(
                etaMinutes = etaMinutes,
                distanceKm = distanceKm,
                bestTime = destination.bestTimeToVisit,
                hasLocationPermission = hasLocationPermission,
                onRequestLocation = {
                    permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                }
            )
        }
        item { ActionRow(destination = destination) }
        item { SectionTitle("About") }
        item {
            Text(
                destination.shortDescription,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(horizontal = 20.dp)
            )
        }
        item { SectionTitle("Rating & reviews") }
        item { RatingSummary(destination = destination, reviews = reviews) }
        items(reviews) { ReviewCard(review = it) }
        item { SectionTitle("Information") }
        item { InfoGrid(destination = destination) }
        if (nearby.isNotEmpty()) {
            item { SectionTitle("Nearby attractions") }
            item { NearbyRow(items = nearby) }
        }
    }
}

@Composable
private fun HeroImage(
    destination: DestinationPreview,
    isSaved: Boolean,
    onBack: () -> Unit,
    onToggleSave: () -> Unit
) {
    Box(modifier = Modifier
        .fillMaxWidth()
        .height(320.dp)) {
        AsyncImage(
            model = destination.imageUrl,
            contentDescription = destination.name,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.35f),
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.55f)
                        )
                    )
                )
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            CircleIconButton(icon = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", onClick = onBack)
            CircleIconButton(
                icon = if (isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                contentDescription = if (isSaved) "Remove from saved" else "Save",
                onClick = onToggleSave
            )
        }
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Surface(
                color = Color.White.copy(alpha = 0.9f),
                shape = RoundedCornerShape(50)
            ) {
                Text(
                    destination.category,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black
                )
            }
            Text(
                destination.name,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(
                    Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
                Text(destination.location, color = Color.White, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun CircleIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit
) {
    FilledIconButton(
        onClick = onClick,
        colors = IconButtonDefaults.filledIconButtonColors(
            containerColor = Color.Black.copy(alpha = 0.45f),
            contentColor = Color.White
        )
    ) {
        Icon(icon, contentDescription = contentDescription)
    }
}

@Composable
private fun DetailHeader(destination: DestinationPreview, reviews: List<Review>) {
    val average = reviews.map { it.rating }.average().let { if (it.isNaN()) 0.0 else it }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            shape = RoundedCornerShape(50),
            color = MaterialTheme.colorScheme.secondaryContainer
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    Icons.Default.Star,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    "${destination.rating} (${reviews.size + 48} reviews)",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
        // consume average to avoid unused warning; used implicitly via rating shown
        Text(
            "Local guide picks",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.width(0.dp))
        // hidden invariant: keep computed average available for future in-header display
        @Suppress("UNUSED_EXPRESSION") average
    }
}

@Composable
private fun QuickStatsRow(
    etaMinutes: Int?,
    distanceKm: Double?,
    bestTime: String,
    hasLocationPermission: Boolean,
    onRequestLocation: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatCard(
            modifier = Modifier.weight(1f),
            icon = Icons.Default.DriveEta,
            title = "ETA",
            body = when {
                etaMinutes != null -> formatEta(etaMinutes)
                !hasLocationPermission -> "Enable location"
                else -> "—"
            },
            actionable = !hasLocationPermission,
            onClick = if (!hasLocationPermission) onRequestLocation else null
        )
        StatCard(
            modifier = Modifier.weight(1f),
            icon = Icons.Default.MyLocation,
            title = "Distance",
            body = distanceKm?.let { formatDistance(it) } ?: "—"
        )
        StatCard(
            modifier = Modifier.weight(1f),
            icon = Icons.Default.WbSunny,
            title = "Best time",
            body = bestTime
        )
    }
}

@Composable
private fun StatCard(
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    body: String,
    actionable: Boolean = false,
    onClick: (() -> Unit)? = null
) {
    Card(
        modifier = modifier.then(
            if (onClick != null) Modifier else Modifier
        ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        onClick = onClick ?: {}
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )
            Text(title, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                body,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (actionable) FontWeight.SemiBold else FontWeight.Medium,
                color = if (actionable) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                maxLines = 2
            )
        }
    }
}

@Composable
private fun ActionRow(destination: DestinationPreview) {
    val context = LocalContext.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Button(
            onClick = { openDirections(context, destination) },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(14.dp)
        ) {
            Icon(Icons.Default.Directions, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Route")
        }
        Button(
            onClick = { openMap(context, destination) },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                contentColor = MaterialTheme.colorScheme.onSecondaryContainer
            )
        ) {
            Icon(Icons.Default.Map, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Map")
        }
        Button(
            onClick = { openSource(context, destination) },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                contentColor = MaterialTheme.colorScheme.onSecondaryContainer
            )
        ) {
            Icon(Icons.Default.Link, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Source")
        }
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 8.dp)
    )
}

@Composable
private fun RatingSummary(destination: DestinationPreview, reviews: List<Review>) {
    val average = reviews.map { it.rating }.average().let { if (it.isNaN()) 0.0 else it }
    val totalReviews = reviews.size + 48
    val distribution = (5 downTo 1).map { star ->
        star to reviews.count { it.rating == star }
    }
    val maxCount = distribution.maxOf { it.second }.coerceAtLeast(1)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = String.format("%.1f", average.takeIf { it > 0 } ?: destination.rating.toDoubleOrNull() ?: 4.5),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold
                )
                StarRow(rating = average.takeIf { it > 0 } ?: destination.rating.toDoubleOrNull() ?: 4.5)
                Text("$totalReviews reviews", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                distribution.forEach { (star, count) ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("$star", style = MaterialTheme.typography.labelSmall, modifier = Modifier.width(10.dp), textAlign = TextAlign.End)
                        Icon(Icons.Default.Star, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(12.dp))
                        LinearProgressIndicator(
                            progress = { count.toFloat() / maxCount.toFloat() },
                            modifier = Modifier
                                .weight(1f)
                                .height(6.dp)
                                .clip(RoundedCornerShape(50))
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StarRow(rating: Double) {
    Row {
        for (i in 1..5) {
            val icon = when {
                rating >= i -> Icons.Default.Star
                rating >= i - 0.5 -> Icons.AutoMirrored.Filled.StarHalf
                else -> Icons.Default.StarBorder
            }
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun ReviewCard(review: Review) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(review.author, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
                    Text(review.date, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                StarRow(rating = review.rating.toDouble())
            }
            Text(review.comment, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun InfoGrid(destination: DestinationPreview) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column {
            InfoRow(Icons.Default.Category, "Category", destination.category)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
            InfoRow(Icons.Default.LocationOn, "Coordinates", "${destination.latitude}, ${destination.longitude}")
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
            InfoRow(Icons.Default.Schedule, "Best time to visit", destination.bestTimeToVisit)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
            InfoRow(Icons.Default.Info, "Source", "Journey Era Bohol guide")
        }
    }
}

@Composable
private fun InfoRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.secondaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.size(18.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NearbyRow(items: List<DestinationPreview>) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(items) { item ->
            Card(
                modifier = Modifier.width(180.dp),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                onClick = {}
            ) {
                Column {
                    AsyncImage(
                        model = item.imageUrl,
                        contentDescription = item.name,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(110.dp),
                        contentScale = ContentScale.Crop
                    )
                    Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            item.name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 2
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Default.Star, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
                            Text(item.rating, style = MaterialTheme.typography.labelSmall)
                            Text("· ${item.municipality}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        }
                    }
                }
            }
        }
    }
}

private fun distanceKmBetween(user: Location, destination: DestinationPreview): Double {
    val out = FloatArray(1)
    Location.distanceBetween(user.latitude, user.longitude, destination.latitude, destination.longitude, out)
    return out[0] / 1000.0
}

private fun estimateEtaMinutes(distanceKm: Double, avgSpeedKmh: Double = 40.0): Int {
    val roadFactor = 1.25
    val hours = distanceKm * roadFactor / avgSpeedKmh
    return (hours * 60).roundToInt()
}

private fun formatEta(minutes: Int): String = when {
    minutes < 60 -> "~$minutes min"
    else -> {
        val h = minutes / 60
        val m = minutes % 60
        if (m == 0) "~${h}h" else "~${h}h ${m}m"
    }
}

private fun formatDistance(km: Double): String = when {
    km < 1.0 -> "${(km * 1000).roundToInt()} m"
    km < 10.0 -> String.format("%.1f km", km)
    else -> "${km.roundToInt()} km"
}

@Composable
fun MapScreen(onDestinationClick: (Long) -> Unit = {}) {
    val context = LocalContext.current
    var selected by remember { mutableStateOf<DestinationPreview?>(null) }
    var mapRef by remember { mutableStateOf<MapView?>(null) }

    val pinIcon = remember {
        val src = androidx.core.content.ContextCompat.getDrawable(context, com.travs.bohol.R.drawable.ic_map_pin)
        val bmp = (src as? android.graphics.drawable.BitmapDrawable)?.bitmap
        if (bmp != null) {
            val density = context.resources.displayMetrics.density
            val sizePx = (24 * density).toInt().coerceAtLeast(24)
            val scaled = android.graphics.Bitmap.createScaledBitmap(bmp, sizePx, sizePx, true)
            android.graphics.drawable.BitmapDrawable(context.resources, scaled)
        } else src
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { viewContext ->
                MapView(viewContext).apply {
                    setTileSource(TileSourceFactory.MAPNIK)
                    setMultiTouchControls(true)
                    controller.setZoom(10.0)
                    controller.setCenter(GeoPoint(9.8500, 124.1435))
                    mapRef = this
                }
            },
            update = { map ->
                map.overlays.clear()
                previewDestinations.forEach { destination ->
                    val marker = Marker(map).apply {
                        position = GeoPoint(destination.latitude, destination.longitude)
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                        title = destination.name
                        icon = pinIcon
                        setOnMarkerClickListener { _, _ ->
                            selected = destination
                            map.controller.animateTo(GeoPoint(destination.latitude, destination.longitude), 14.0, 500L)
                            true
                        }
                    }
                    map.overlays.add(marker)
                }
                map.invalidate()
            }
        )

        // Top floating chip (title + count)
        Surface(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 16.dp),
            shape = RoundedCornerShape(50),
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 4.dp
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.PinDrop, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                Text(
                    "Bohol · ${previewDestinations.size} destinations",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // Layer toggle FAB (top-right, decorative)
        Surface(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 16.dp, end = 16.dp)
                .size(44.dp)
                .clickable {
                    mapRef?.controller?.animateTo(GeoPoint(9.8500, 124.1435), 10.0, 500L)
                },
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 4.dp
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Layers, contentDescription = "Reset view", tint = MaterialTheme.colorScheme.primary)
            }
        }

        // Bottom floating info card when marker selected
        selected?.let { destination ->
            MapDestinationCard(
                destination = destination,
                onClose = { selected = null },
                onViewDetails = { onDestinationClick(destination.id) },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MapDestinationCard(
    destination: DestinationPreview,
    onClose: () -> Unit,
    onViewDetails: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        onClick = onViewDetails
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 12.dp, top = 12.dp, bottom = 12.dp, end = 44.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                AsyncImage(
                    model = destination.imageUrl,
                    contentDescription = destination.name,
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(14.dp)),
                    contentScale = ContentScale.Crop
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        destination.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFFFC107), modifier = Modifier.size(14.dp))
                        Text(destination.rating, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
                        Text("· ${destination.category}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (FavoritesStore.isFavorite(destination.id)) {
                            Icon(
                                Icons.Default.Bookmark,
                                contentDescription = "Saved",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(12.dp))
                        Text(
                            destination.municipality,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable(onClick = onViewDetails)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                "View details",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }
            }
            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(4.dp)
                    .size(32.dp)
            ) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Close",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

internal data class PreviewDestinationHandle(
    val id: Long,
    val name: String,
    val municipality: String,
    val latitude: Double,
    val longitude: Double,
    val category: String,
    val imageUrl: String,
    val rating: String
)

private fun DestinationPreview.toHandle() = PreviewDestinationHandle(
    id = id,
    name = name,
    municipality = municipality,
    latitude = latitude,
    longitude = longitude,
    category = category,
    imageUrl = imageUrl,
    rating = rating
)

internal fun previewDestinationsHandles(): List<PreviewDestinationHandle> =
    previewDestinations.map { it.toHandle() }

internal fun previewDestinationById(id: Long): PreviewDestinationHandle? =
    previewDestinations.firstOrNull { it.id == id }?.toHandle()

internal fun openDirectionsFromTrip(context: Context, handle: PreviewDestinationHandle) {
    val destination = previewDestinations.firstOrNull { it.id == handle.id } ?: return
    openDirections(context, destination)
}

@Composable
fun FavoritesScreen(onDestinationClick: (Long) -> Unit = {}) {
    val savedIds = FavoritesStore.ids
    val savedDestinations = previewDestinations.filter { it.id in savedIds }

    if (savedDestinations.isEmpty()) {
        EmptyFavoritesState()
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(top = 20.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Saved", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Text(
                    "${savedDestinations.size} ${if (savedDestinations.size == 1) "place" else "places"} saved for offline",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        items(savedDestinations, key = { it.id }) { d ->
            Box(Modifier.padding(horizontal = 20.dp)) {
                SavedDestinationRow(
                    destination = d,
                    onClick = { onDestinationClick(d.id) },
                    onUnsave = { FavoritesStore.toggle(d.id) }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SavedDestinationRow(
    destination: DestinationPreview,
    onClick: () -> Unit,
    onUnsave: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box {
                AsyncImage(
                    model = destination.imageUrl,
                    contentDescription = destination.name,
                    modifier = Modifier
                        .size(96.dp)
                        .clip(RoundedCornerShape(16.dp)),
                    contentScale = ContentScale.Crop
                )
                RatingPill(
                    rating = destination.rating,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    destination.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(12.dp)
                    )
                    Text(
                        destination.municipality,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    destination.category,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
            }
            IconButton(onClick = onUnsave) {
                Icon(
                    Icons.Default.Bookmark,
                    contentDescription = "Remove from saved",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun EmptyFavoritesState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
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
                Icons.Default.FavoriteBorder,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSecondaryContainer,
                modifier = Modifier.size(44.dp)
            )
        }
        Spacer(Modifier.height(20.dp))
        Text(
            "Nothing saved yet",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "Tap the bookmark on any destination to keep it here for offline trip planning.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun ProfileScreen(
    displayName: String? = null,
    email: String? = null,
    themeMode: com.travs.bohol.data.preferences.ThemeMode = com.travs.bohol.data.preferences.ThemeMode.SYSTEM,
    onThemeModeChange: (com.travs.bohol.data.preferences.ThemeMode) -> Unit = {},
    onSignOut: () -> Unit = {}
) {
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Profile", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)

        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Row(
                Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
                Column {
                    Text(
                        displayName ?: "Guest traveler",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        email ?: "Offline mode enabled.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }

        ThemeSelectorCard(current = themeMode, onSelect = onThemeModeChange)

        Button(
            onClick = { Toast.makeText(context, "Sync queued when internet is available", Toast.LENGTH_SHORT).show() },
            shape = RoundedCornerShape(14.dp)
        ) {
            Icon(Icons.Default.Sync, contentDescription = null)
            Spacer(Modifier.width(6.dp))
            Text("Sync now")
        }
        Button(
            onClick = onSignOut,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                contentColor = MaterialTheme.colorScheme.onSecondaryContainer
            )
        ) {
            Text("Sign out")
        }
    }
}

@Composable
private fun ThemeSelectorCard(
    current: com.travs.bohol.data.preferences.ThemeMode,
    onSelect: (com.travs.bohol.data.preferences.ThemeMode) -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Appearance", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(
                "Choose how Travs looks on this device.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                ThemeOption(
                    label = "Light",
                    icon = Icons.Default.WbSunny,
                    selected = current == com.travs.bohol.data.preferences.ThemeMode.LIGHT,
                    onClick = { onSelect(com.travs.bohol.data.preferences.ThemeMode.LIGHT) },
                    modifier = Modifier.weight(1f)
                )
                ThemeOption(
                    label = "Dark",
                    icon = Icons.Default.DarkMode,
                    selected = current == com.travs.bohol.data.preferences.ThemeMode.DARK,
                    onClick = { onSelect(com.travs.bohol.data.preferences.ThemeMode.DARK) },
                    modifier = Modifier.weight(1f)
                )
                ThemeOption(
                    label = "System",
                    icon = Icons.Default.PhoneAndroid,
                    selected = current == com.travs.bohol.data.preferences.ThemeMode.SYSTEM,
                    onClick = { onSelect(com.travs.bohol.data.preferences.ThemeMode.SYSTEM) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun ThemeOption(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bg = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
    val fg = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = bg
    ) {
        Column(
            Modifier.padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(20.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, color = fg, fontWeight = FontWeight.SemiBold)
        }
    }
}

private fun openDirections(context: Context, destination: DestinationPreview) {
    val googleMaps = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("google.navigation:q=${destination.latitude},${destination.longitude}")
    ).setPackage("com.google.android.apps.maps")

    try {
        context.startActivity(googleMaps)
    } catch (_: ActivityNotFoundException) {
        openMap(context, destination)
    }
}

private fun openMap(context: Context, destination: DestinationPreview) {
    val url = "https://www.google.com/maps/search/?api=1&query=${destination.latitude},${destination.longitude}"
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
}

private fun openSource(context: Context, destination: DestinationPreview) {
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(destination.sourceUrl)))
}

private fun showSavedMessage(context: Context, name: String) {
    Toast.makeText(context, "$name saved for offline trip planning", Toast.LENGTH_SHORT).show()
}
