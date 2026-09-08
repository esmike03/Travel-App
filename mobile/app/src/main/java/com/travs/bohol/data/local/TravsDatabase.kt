package com.travs.bohol.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        DestinationEntity::class,
        CategoryEntity::class,
        MunicipalityEntity::class,
        DestinationImageEntity::class,
        ItineraryItemEntity::class,
        PendingSyncEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class TravsDatabase : RoomDatabase() {
    abstract fun destinationDao(): DestinationDao
    abstract fun categoryDao(): CategoryDao
    abstract fun destinationImageDao(): DestinationImageDao
    abstract fun itineraryDao(): ItineraryDao
    abstract fun pendingSyncDao(): PendingSyncDao

    companion object {
        fun create(context: Context): TravsDatabase =
            Room.databaseBuilder(context, TravsDatabase::class.java, "travs.db")
                .build()
    }
}
