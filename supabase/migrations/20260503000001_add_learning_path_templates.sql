-- ─── Learning Path Templates ───────────────────────────────────────────────
-- Two new public-read tables for curated template paths. Templates flow
-- through the existing hydrateP3P4 pipeline — no new API endpoints.
-- Templates are public-read, no user_id column.
--
-- Design decisions (see plan):
--   * Separate tables to avoid RLS complexity with existing learning_paths
--   * Templates merge into Dexie learningPaths table with isTemplate=true
--   * Template entries carry match_title for course auto-linking at fork time
--   * Idempotent seed data — ON CONFLICT DO NOTHING on re-run

CREATE TABLE IF NOT EXISTS public.learning_path_templates (
  id                TEXT        PRIMARY KEY,
  name              TEXT        NOT NULL,
  description       TEXT,
  course_count      INTEGER     NOT NULL DEFAULT 0,
  estimated_hours   INTEGER,
  difficulty_label  TEXT,
  topic_tags        TEXT[]      DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_path_template_entries (
  id                TEXT        PRIMARY KEY,
  template_id       TEXT        NOT NULL,
  course_id         TEXT,
  match_title       TEXT,
  position          INTEGER     NOT NULL DEFAULT 0,
  title             TEXT        NOT NULL,
  justification     TEXT,
  estimated_hours   INTEGER,
  topic_tags        TEXT[]      DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_template_entries_template
  ON public.learning_path_template_entries (template_id, position);

-- Public read — anyone can browse templates (even unauthenticated users)
ALTER TABLE public.learning_path_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_path_template_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read templates" ON public.learning_path_templates;
CREATE POLICY "Public read templates"
  ON public.learning_path_templates
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read template entries" ON public.learning_path_template_entries;
CREATE POLICY "Public read template entries"
  ON public.learning_path_template_entries
  FOR SELECT
  USING (true);

-- ─── Seed Data: 5 Initial Templates ──────────────────────────────────────────

INSERT INTO public.learning_path_templates (id, name, description, course_count, estimated_hours, difficulty_label, topic_tags) VALUES
('template_full-stack-dev',
 'Full-Stack Web Development',
 'A comprehensive journey from HTML basics to deploying full-stack applications. Covers frontend frameworks, backend APIs, databases, and DevOps essentials.',
 7, 120, 'Beginner → Intermediate',
 ARRAY['javascript', 'react', 'nodejs', 'databases', 'devops']),

('template_data-science',
 'Data Science Foundations',
 'Build a strong foundation in data analysis, statistics, and machine learning. Progress from data wrangling to building predictive models.',
 6, 100, 'Beginner → Intermediate',
 ARRAY['python', 'statistics', 'machine-learning', 'data-visualization', 'sql']),

('template_ios-dev',
 'iOS Development',
 'Learn to build native iOS applications from scratch. Covers Swift, SwiftUI, app architecture, and App Store deployment.',
 6, 90, 'Beginner → Advanced',
 ARRAY['swift', 'swiftui', 'ios', 'mobile', 'xcode']),

('template_ml-engineering',
 'Machine Learning Engineering',
 'From classical ML algorithms to deep learning and MLOps. Bridges the gap between data science prototypes and production ML systems.',
 7, 140, 'Intermediate → Advanced',
 ARRAY['python', 'deep-learning', 'mlops', 'tensorflow', 'pytorch']),

('template_product-design',
 'Product Design',
 'Master the end-to-end design process: user research, interaction design, visual design, and design systems. Build a portfolio-ready case study.',
 5, 60, 'Beginner → Intermediate',
 ARRAY['design', 'ux', 'figma', 'research', 'prototyping'])
ON CONFLICT (id) DO NOTHING;

-- Template entries describe sequenced courses. match_title is used at fork
-- time to auto-link against the user's imported courses. course_id is null
-- for descriptive-only entries — matching is title-based.
INSERT INTO public.learning_path_template_entries (id, template_id, course_id, match_title, position, title, justification, estimated_hours, topic_tags) VALUES
-- Full-Stack Web Development
('tpl_entry_fs_01', 'template_full-stack-dev', NULL, 'HTML & CSS Fundamentals', 1, 'HTML & CSS Fundamentals', 'Start with the building blocks of the web. Understanding semantic HTML and modern CSS layout (Flexbox, Grid) is essential before any framework.', 15, ARRAY['html', 'css', 'web-fundamentals']),
('tpl_entry_fs_02', 'template_full-stack-dev', NULL, 'JavaScript: The Complete Guide', 2, 'JavaScript: The Complete Guide', 'Master JavaScript fundamentals — the language that powers both frontend and backend. Focus on ES6+, async patterns, and the DOM.', 25, ARRAY['javascript', 'es6', 'async']),
('tpl_entry_fs_03', 'template_full-stack-dev', NULL, 'React: The Complete Guide', 3, 'React: The Complete Guide', 'Build modern UIs with React. Learn components, hooks, state management, and routing — the skills that make you productive on any frontend team.', 25, ARRAY['react', 'frontend', 'hooks']),
('tpl_entry_fs_04', 'template_full-stack-dev', NULL, 'Node.js & Express', 4, 'Node.js & Express', 'Move to the backend with Node.js. Build REST APIs, handle authentication, and connect to databases — completing your full-stack skill set.', 20, ARRAY['nodejs', 'express', 'api', 'backend']),
('tpl_entry_fs_05', 'template_full-stack-dev', NULL, 'SQL & Database Design', 5, 'SQL & Database Design', 'Learn to model data, write efficient queries, and design schemas. Database skills separate junior from senior developers.', 15, ARRAY['sql', 'postgresql', 'database-design']),
('tpl_entry_fs_06', 'template_full-stack-dev', NULL, 'Docker & Containers', 6, 'Docker & Containers', 'Containerize your applications for consistent development and deployment. Understand Dockerfiles, Compose, and basic orchestration.', 10, ARRAY['docker', 'containers', 'devops']),
('tpl_entry_fs_07', 'template_full-stack-dev', NULL, 'CI/CD & Deployment', 7, 'CI/CD & Deployment', 'Ship your code with confidence. Set up continuous integration, automated testing, and deployment pipelines.', 10, ARRAY['ci-cd', 'deployment', 'github-actions']),

-- Data Science Foundations
('tpl_entry_ds_01', 'template_data-science', NULL, 'Python for Data Science', 1, 'Python for Data Science', 'Learn Python specifically for data work — NumPy, Pandas, and Jupyter notebooks. The essential toolkit every data scientist needs.', 20, ARRAY['python', 'numpy', 'pandas']),
('tpl_entry_ds_02', 'template_data-science', NULL, 'Statistics & Probability', 2, 'Statistics & Probability', 'Build the mathematical foundation. Descriptive statistics, probability distributions, hypothesis testing, and Bayesian thinking.', 20, ARRAY['statistics', 'probability', 'math']),
('tpl_entry_ds_03', 'template_data-science', NULL, 'Data Visualization', 3, 'Data Visualization', 'Communicate insights effectively. Master matplotlib, seaborn, and interactive visualization libraries — plus the principles of visual perception.', 10, ARRAY['data-visualization', 'matplotlib', 'seaborn']),
('tpl_entry_ds_04', 'template_data-science', NULL, 'SQL for Data Analysis', 4, 'SQL for Data Analysis', 'Query, aggregate, and transform data at scale. Learn window functions, CTEs, and query optimization for analytical workloads.', 15, ARRAY['sql', 'analytics', 'bigquery']),
('tpl_entry_ds_05', 'template_data-science', NULL, 'Machine Learning Fundamentals', 5, 'Machine Learning Fundamentals', 'From linear regression to random forests. Understand model selection, evaluation, and the scikit-learn ecosystem.', 20, ARRAY['machine-learning', 'scikit-learn', 'supervised-learning']),
('tpl_entry_ds_06', 'template_data-science', NULL, 'Feature Engineering & Model Deployment', 6, 'Feature Engineering & Model Deployment', 'Take models from notebook to production. Feature stores, model serialization, and basic serving infrastructure.', 15, ARRAY['mlops', 'feature-engineering', 'deployment']),

-- iOS Development
('tpl_entry_ios_01', 'template_ios-dev', NULL, 'Swift Programming', 1, 'Swift Programming', 'Master Apple''s modern programming language. Optionals, protocols, generics, and concurrency — the language features that make Swift unique.', 20, ARRAY['swift', 'programming', 'apple']),
('tpl_entry_ios_02', 'template_ios-dev', NULL, 'SwiftUI Fundamentals', 2, 'SwiftUI Fundamentals', 'Build interfaces declaratively with SwiftUI. Views, modifiers, state management, and navigation — the modern iOS UI paradigm.', 15, ARRAY['swiftui', 'ios', 'declarative-ui']),
('tpl_entry_ios_03', 'template_ios-dev', NULL, 'iOS App Architecture', 3, 'iOS App Architecture', 'Design maintainable apps with MVVM, Clean Architecture, and dependency injection. Patterns that scale from prototype to App Store.', 15, ARRAY['architecture', 'mvvm', 'ios']),
('tpl_entry_ios_04', 'template_ios-dev', NULL, 'Networking & Data Persistence', 4, 'Networking & Data Persistence', 'Connect your app to the world. URLSession, Codable, Core Data, and SwiftData — fetching, caching, and syncing data.', 15, ARRAY['networking', 'core-data', 'swiftdata']),
('tpl_entry_ios_05', 'template_ios-dev', NULL, 'Advanced iOS Features', 5, 'Advanced iOS Features', 'Push notifications, background tasks, widgets, and Siri integration. The features that make apps feel native and polished.', 15, ARRAY['notifications', 'widgets', 'ios-advanced']),
('tpl_entry_ios_06', 'template_ios-dev', NULL, 'App Store Submission', 6, 'App Store Submission', 'From code to customer. App Store Connect, TestFlight, app review guidelines, and ASO basics.', 10, ARRAY['app-store', 'deployment', 'testflight']),

-- Machine Learning Engineering
('tpl_entry_ml_01', 'template_ml-engineering', NULL, 'Python & ML Libraries', 1, 'Python & ML Libraries', 'Build a production-ready Python environment for ML. NumPy, Pandas, scikit-learn, and the scientific Python ecosystem.', 15, ARRAY['python', 'numpy', 'scikit-learn']),
('tpl_entry_ml_02', 'template_ml-engineering', NULL, 'Classical Machine Learning', 2, 'Classical Machine Learning', 'Regression, classification, clustering, and dimensionality reduction. Master the algorithms that solve 80% of business ML problems.', 25, ARRAY['machine-learning', 'supervised-learning', 'unsupervised-learning']),
('tpl_entry_ml_03', 'template_ml-engineering', NULL, 'Deep Learning', 3, 'Deep Learning', 'Neural networks, CNNs, RNNs, and transformers. Build and train models with PyTorch and understand the architectures behind modern AI.', 30, ARRAY['deep-learning', 'pytorch', 'neural-networks']),
('tpl_entry_ml_04', 'template_ml-engineering', NULL, 'MLOps Fundamentals', 4, 'MLOps Fundamentals', 'The bridge between ML research and production. Experiment tracking, model versioning, pipeline orchestration, and monitoring.', 20, ARRAY['mlops', 'pipelines', 'experiment-tracking']),
('tpl_entry_ml_05', 'template_ml-engineering', NULL, 'Model Serving & APIs', 5, 'Model Serving & APIs', 'Deploy models as scalable services. REST and gRPC APIs, batch inference, model optimization, and latency considerations.', 20, ARRAY['model-serving', 'api', 'fastapi']),
('tpl_entry_ml_06', 'template_ml-engineering', NULL, 'ML System Design', 6, 'ML System Design', 'Design end-to-end ML systems. Data pipelines, feature stores, model registries, A/B testing, and continuous training.', 15, ARRAY['system-design', 'feature-stores', 'ab-testing']),
('tpl_entry_ml_07', 'template_ml-engineering', NULL, 'ML Infrastructure', 7, 'ML Infrastructure', 'GPU compute, distributed training, and cloud ML platforms. The infrastructure that makes large-scale ML possible.', 15, ARRAY['gpu', 'kubernetes', 'cloud-ml']),

-- Product Design
('tpl_entry_pd_01', 'template_product-design', NULL, 'User Research Methods', 1, 'User Research Methods', 'Learn to understand users deeply. Interviews, surveys, usability testing, and synthesis — the foundation of evidence-based design.', 12, ARRAY['user-research', 'interviews', 'usability']),
('tpl_entry_pd_02', 'template_product-design', NULL, 'Interaction Design', 2, 'Interaction Design', 'Design how products behave. Information architecture, user flows, wireframing, and prototyping — turning research into structure.', 15, ARRAY['interaction-design', 'ia', 'wireframing']),
('tpl_entry_pd_03', 'template_product-design', NULL, 'Visual Design Principles', 3, 'Visual Design Principles', 'Typography, color, spacing, and hierarchy. The craft skills that make interfaces not just usable but delightful.', 12, ARRAY['visual-design', 'typography', 'color-theory']),
('tpl_entry_pd_04', 'template_product-design', NULL, 'Design Systems', 4, 'Design Systems', 'Build systems that scale. Components, tokens, documentation, and governance — how design organizations ship consistently.', 10, ARRAY['design-systems', 'components', 'tokens']),
('tpl_entry_pd_05', 'template_product-design', NULL, 'Portfolio Case Study', 5, 'Portfolio Case Study', 'Synthesize your learning into a complete case study. End-to-end project from problem definition through shipped solution.', 11, ARRAY['portfolio', 'case-study', 'storytelling'])
ON CONFLICT (id) DO NOTHING;
