<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('travs:import-destinations')->dailyAt('02:30');
