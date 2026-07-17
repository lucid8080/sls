-- phpMyAdmin SQL Dump
-- Database: `sample_wp`

CREATE TABLE `wp_posts` (
  `ID` bigint(20) UNSIGNED NOT NULL,
  `post_author` bigint(20) UNSIGNED NOT NULL DEFAULT '0',
  `post_date` datetime NOT NULL,
  `post_date_gmt` datetime NOT NULL,
  `post_content` longtext NOT NULL,
  `post_title` text NOT NULL,
  `post_excerpt` text NOT NULL,
  `post_status` varchar(20) NOT NULL DEFAULT 'publish',
  `post_name` varchar(200) NOT NULL DEFAULT '',
  `post_modified` datetime NOT NULL,
  `post_modified_gmt` datetime NOT NULL,
  `post_parent` bigint(20) UNSIGNED NOT NULL DEFAULT '0',
  `guid` varchar(255) NOT NULL DEFAULT '',
  `post_type` varchar(20) NOT NULL DEFAULT 'post',
  `post_mime_type` varchar(100) NOT NULL DEFAULT ''
);
CREATE TABLE `wp_postmeta` (`meta_id` bigint(20), `post_id` bigint(20), `meta_key` varchar(255), `meta_value` longtext);
CREATE TABLE `wp_terms` (`term_id` bigint(20), `name` varchar(200), `slug` varchar(200));
CREATE TABLE `wp_term_taxonomy` (`term_taxonomy_id` bigint(20), `term_id` bigint(20), `taxonomy` varchar(32), `description` longtext, `parent` bigint(20), `count` bigint(20));
CREATE TABLE `wp_term_relationships` (`object_id` bigint(20), `term_taxonomy_id` bigint(20), `term_order` int(11));
CREATE TABLE `wp_users` (`ID` bigint(20), `user_login` varchar(60), `user_email` varchar(100), `display_name` varchar(250));
CREATE TABLE `wp_usermeta` (`umeta_id` bigint(20), `user_id` bigint(20), `meta_key` varchar(255), `meta_value` longtext);
CREATE TABLE `wp_options` (`option_id` bigint(20), `option_name` varchar(191), `option_value` longtext, `autoload` varchar(20));
CREATE TABLE `plugin_noise` (`id` bigint(20), `payload` longtext);

INSERT INTO `wp_posts` (`ID`, `post_author`, `post_date`, `post_date_gmt`, `post_content`, `post_title`, `post_excerpt`, `post_status`, `post_name`, `post_modified`, `post_modified_gmt`, `post_parent`, `guid`, `post_type`, `post_mime_type`) VALUES
(1, 1, '2020-01-01 12:00:00', '2020-01-01 12:00:00', '<p>Hello, world</p>', 'Published Post', 'Short excerpt', 'publish', 'published-post', '2020-01-02 12:00:00', '2020-01-02 12:00:00', 0, 'https://example.test/published-post/', 'post', ''),
(2, 1, '2020-01-03 12:00:00', '2020-01-03 12:00:00', '<p>Draft</p>', 'Draft Post', '', 'draft', 'draft-post', '2020-01-03 12:00:00', '2020-01-03 12:00:00', 0, 'https://example.test/draft-post/', 'post', ''),
(3, 1, '2020-01-04 12:00:00', '2020-01-04 12:00:00', '<p>Page</p>', 'Published Page', '', 'publish', 'published-page', '2020-01-04 12:00:00', '2020-01-04 12:00:00', 0, 'https://example.test/published-page/', 'page', ''),
(4, 1, '2020-01-05 12:00:00', '2020-01-05 12:00:00', '', 'Hero Image', '', 'inherit', 'hero-image', '2020-01-05 12:00:00', '2020-01-05 12:00:00', 1, 'https://example.test/wp-content/uploads/2020/01/hero.jpg', 'attachment', 'image/jpeg'),
(5, 1, '2020-01-06 12:00:00', '2020-01-06 12:00:00', '', 'Orphan Image', '', 'inherit', 'orphan-image', '2020-01-06 12:00:00', '2020-01-06 12:00:00', 999, 'https://example.test/wp-content/uploads/2020/01/orphan.jpg', 'attachment', 'image/jpeg'),
(6, 1, '2020-01-07 12:00:00', '2020-01-07 12:00:00', '<p>Revision</p>', 'Revision', '', 'inherit', '1-revision-v1', '2020-01-07 12:00:00', '2020-01-07 12:00:00', 1, '', 'revision', ''),
(7, 1, '2020-01-08 12:00:00', '2020-01-08 12:00:00', '', 'Menu Item', '', 'publish', 'menu-item', '2020-01-08 12:00:00', '2020-01-08 12:00:00', 0, '', 'nav_menu_item', ''),
(8, 1, '2020-01-09 12:00:00', '2020-01-09 12:00:00', '<p>Product</p>', 'Product CPT', '', 'publish', 'product-cpt', '2020-01-09 12:00:00', '2020-01-09 12:00:00', 0, '', 'product', '');

INSERT INTO `wp_postmeta` (`meta_id`, `post_id`, `meta_key`, `meta_value`) VALUES
(1, 4, '_wp_attached_file', '2020/01/hero.jpg'),
(2, 5, '_wp_attached_file', '2020/01/orphan.jpg'),
(3, 1, '_thumbnail_id', '4'),
(4, 4, '_wp_attachment_image_alt', 'Hero alt text'),
(5, 4, '_wp_attachment_metadata', 'a:5:{s:5:"width";i:1200;s:6:"height";i:800;s:4:"file";s:16:"2020/01/hero.jpg";s:5:"sizes";a:2:{s:9:"thumbnail";a:4:{s:4:"file";s:16:"hero-150x150.jpg";s:5:"width";i:150;s:6:"height";i:150;s:9:"mime-type";s:10:"image/jpeg";}s:6:"medium";a:4:{s:4:"file";s:16:"hero-300x200.jpg";s:5:"width";i:300;s:6:"height";i:200;s:9:"mime-type";s:10:"image/jpeg";}}s:10:"image_meta";a:0:{}}');

INSERT INTO `wp_terms` (`term_id`, `name`, `slug`) VALUES
(1, 'Guides', 'guides');
INSERT INTO `wp_term_taxonomy` (`term_taxonomy_id`, `term_id`, `taxonomy`, `description`, `parent`, `count`) VALUES
(10, 1, 'category', '', 0, 1);
INSERT INTO `wp_term_relationships` (`object_id`, `term_taxonomy_id`, `term_order`) VALUES
(1, 10, 0);
INSERT INTO `wp_users` (`ID`, `user_login`, `user_email`, `display_name`) VALUES
(1, 'admin', 'admin@example.test', 'Admin');
INSERT INTO `wp_usermeta` (`umeta_id`, `user_id`, `meta_key`, `meta_value`) VALUES
(1, 1, 'wp_capabilities', 'a:1:{s:13:"administrator";b:1;}');
INSERT INTO `wp_options` (`option_id`, `option_name`, `option_value`, `autoload`) VALUES
(1, 'siteurl', 'https://example.test', 'yes'),
(2, 'permalink_structure', '/%postname%/', 'yes');
INSERT INTO `plugin_noise` (`id`, `payload`) VALUES
(1, 'must not be parsed');
