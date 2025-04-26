DreamGrant - Scholarship Management App
=====================================

Project Structure
----------------
app/
├── src/
│   ├── main/
│   │   ├── java/com/example/dreamgrant/
│   │   │   ├── api/           # API interfaces and models
│   │   │   ├── data/          # Data models and repositories
│   │   │   ├── di/            # Dependency injection modules
│   │   │   ├── model/         # Domain models
│   │   │   ├── network/       # Network related classes
│   │   │   ├── repository/    # Repository implementations
│   │   │   ├── service/       # Background services
│   │   │   ├── ui/            # UI components
│   │   │   ├── util/          # Utility classes
│   │   │   ├── viewmodel/     # ViewModels
│   │   │   ├── worker/        # WorkManager workers
│   │   │   ├── MainActivity.kt
│   │   │   ├── SplashActivity.kt
│   │   │   └── ScholarshipDetailActivity.kt
│   │   ├── res/               # Resources (layouts, drawables, etc.)
│   │   └── AndroidManifest.xml
│   └── test/                  # Unit tests
├── build.gradle               # App-level build configuration
└── proguard-rules.pro         # ProGuard rules

gradle/
└── libs.versions.toml         # Version catalog for dependencies

build.gradle                   # Project-level build configuration
settings.gradle               # Project settings

Key Features
-----------
1. Scholarship Management
   - View available scholarships
   - Detailed scholarship information
   - Bookmark favorite scholarships
   - Apply for scholarships

2. Background Sync
   - Periodic scholarship updates
   - WorkManager for background tasks
   - Hilt for dependency injection

3. Modern Architecture
   - MVVM architecture
   - Repository pattern
   - Clean separation of concerns
   - Dependency injection with Hilt

Dependencies
-----------
- AndroidX Core KTX: 1.16.0
- AppCompat: 1.7.0
- Material Design: 1.12.0
- ConstraintLayout: 2.2.1
- WorkManager: 2.10.1
- Hilt: 2.56.2
- Kotlin: 1.9.0
- Android Gradle Plugin: 8.2.0

Setup Instructions
----------------
1. Clone the repository
2. Open the project in Android Studio
3. Sync Gradle files
4. Run the app on an emulator or physical device

Build Configuration
-----------------
- Minimum SDK: 24
- Target SDK: 35
- Compile SDK: 35
- Java Version: 17
- Kotlin Version: 1.9.0

Development Guidelines
--------------------
1. Follow MVVM architecture
2. Use dependency injection with Hilt
3. Implement repository pattern for data operations
4. Use WorkManager for background tasks
5. Follow Material Design guidelines
6. Write unit tests for critical components

Note: This project uses version catalogs for dependency management.
All dependencies are defined in gradle/libs.versions.toml. 