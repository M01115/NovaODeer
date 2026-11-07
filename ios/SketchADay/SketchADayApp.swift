import SwiftUI

@main
struct SketchADayApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.light)
        }
    }
}

/// Tabs: Today, Feed, Collection. Ported from mobile/src/components/app-tabs.tsx.
struct RootView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Today", systemImage: "pencil") }
            FeedView()
                .tabItem { Label("Feed", systemImage: "person.2") }
            CollectionView()
                .tabItem { Label("Collection", systemImage: "square.grid.2x2") }
        }
        .tint(Palette.text)
    }
}

extension View {
    /// Full-screen cover on iPhone, sheet elsewhere (keeps the code building for macOS checks).
    func fullScreen<Content: View>(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        #if os(iOS)
        fullScreenCover(isPresented: isPresented, onDismiss: onDismiss, content: content)
        #else
        sheet(isPresented: isPresented, onDismiss: onDismiss, content: content)
        #endif
    }
}

#Preview {
    RootView()
}
