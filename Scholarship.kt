data class Scholarship(
    val id: String,
    val title: String,
    val organization: String,
    val type: String,
    val eligibility: String,
    val benefits: String,
    val documents: List<String>,
    val deadlines: List<String>,
    val applyLink: String,
    val tags: List<String>
) 