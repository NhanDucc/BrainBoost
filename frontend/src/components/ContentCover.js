/**
 * ContentCover Component
 * Generates a dynamic, CSS-based cover image for courses or tests.
 * Automatically applies a pastel color gradient based on the subject 
 * and formats the title to include the grade level.
 */
export default function ContentCover({ title, subject, grade, coverUrl, className, style }) {
    
    // If a valid cover URL exists, render the actual image
    if (coverUrl && coverUrl.trim() !== "") {
        return <img src={coverUrl} alt={title} className={className} style={{ objectFit: 'cover', ...style }} />;
    }

    // If no image is provided, render the dynamic CSS placeholder
    
    /**
     * Determines the background gradient based on the specific subject.
     * Uses a predefined pastel color palette for visual consistency.
     */
    const getBackground = (sub) => {
        const s = (sub || "").toLowerCase();
        if (s.includes("math")) return "linear-gradient(135deg, #A2D2FF, #D0EFFF)";      // Math - Pastel Blue
        if (s.includes("physic")) return "linear-gradient(135deg, #FFF9C4, #FFF59D)";    // Physics - Pastel Yellow
        if (s.includes("chemist")) return "linear-gradient(135deg, #C1E1C1, #E2F0D9)";   // Chemistry - Pastel Green
        if (s.includes("english")) return "linear-gradient(135deg, #FFC4D0, #FFDDE2)";   // English - Pastel Pink
        return "linear-gradient(135deg, #E2E8F0, #F8FAFC)";                              // Default - Light Gray
    };

    /**
     * Formats the display name.
     * Appends the grade to the title only if it exists and isn't already part of the title.
     * Example: title="Calculus", grade="12" => "Calculus 12"
     */
    const safeTitle = title || "Untitled";
    const displayTitle = (grade && !safeTitle.includes(grade.toString())) 
        ? `${safeTitle} ${grade}` 
        : safeTitle;

    return (
        <div 
            className={className} 
            style={{
                background: getBackground(subject),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                textAlign: 'center',
                width: '100%',
                height: '100%',
                minHeight: '130px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                position: 'relative',
                ...style
            }}
        >
            {/* Subtle dotted pattern overlay to add visual texture to the flat gradient */}
            <div style={{
                position: 'absolute', inset: 0, opacity: 0.1,
                backgroundImage: 'radial-gradient(circle at 2px 2px, #334155 1px, transparent 0)',
                backgroundSize: '20px 20px'
            }}></div>

            {/* Typography for the Title */}
            <h3 style={{
                margin: 0,
                color: '#334155',
                fontSize: 'clamp(16px, 4vw, 20px)',
                fontWeight: '900',
                lineHeight: '1.3',
                textShadow: '0px 2px 4px rgba(255,255,255,0.6)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 1
            }}>
                {displayTitle}
            </h3>
        </div>
    );
}