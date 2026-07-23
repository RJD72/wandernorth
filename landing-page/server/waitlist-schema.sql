CREATE TABLE waitlist_submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(80) NOT NULL,
    email VARCHAR(254) NOT NULL,
    region VARCHAR(100) NOT NULL,
    travel_style VARCHAR(100) NOT NULL,
    desired_outcome TEXT NOT NULL,
    value_reason VARCHAR(180) NULL,
    pricing_preference VARCHAR(180) NULL,
    wants_early_testing TINYINT(1) NOT NULL DEFAULT 0,
    utm_source VARCHAR(150) NULL,
    utm_medium VARCHAR(150) NULL,
    utm_campaign VARCHAR(150) NULL,
    utm_content VARCHAR(150) NULL,
    consent_text_version VARCHAR(50) NOT NULL,
    consent_received_at DATETIME NOT NULL,
    submission_count INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY waitlist_submissions_email_unique (email),
    KEY waitlist_submissions_created_at_index (created_at),
    KEY waitlist_submissions_early_testing_index (wants_early_testing)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
