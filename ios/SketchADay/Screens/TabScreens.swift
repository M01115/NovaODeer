import SwiftUI

/// Feed: everyone's sketches for today's prompt, friends first.
/// Reactions come from the fixed positive set in `Reactions`.
/// Ported from mobile/src/app/(tabs)/feed.tsx.
struct FeedView: View {
    var body: some View {
        Screen {
            Text("Feed").textStyle(.subtitle)
            EmptyState(
                emoji: "🎨",
                title: "No sketches yet",
                message: "Sketches from friends show up first, then everyone else's take on today's prompt."
            )
        }
    }
}

/// Collection: the user's own past sketches, so they can see progress.
/// Ported from mobile/src/app/(tabs)/collection.tsx.
struct CollectionView: View {
    var body: some View {
        Screen {
            Text("My sketches").textStyle(.subtitle)
            EmptyState(
                emoji: "📒",
                title: "Your collection starts today",
                message: "Every sketch you submit lands here, so you can look back and see how far you've come."
            )
        }
    }
}
