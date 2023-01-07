import React, { useEffect, useState } from "react"
import { useParams } from 'react-router-dom';
import Layout from "../containers/Layout"
import Spinner from "../components/Spinner"
import BlogPostsSection from "../components/BlogPostsSection"
import BlogPostsList from "../components/BlogPostsList"
import SEO from "../components/SEO"
import { butterCMS } from "../utils/buttercmssdk";
import { useCategories, useMenuItems } from "../utils/hooks";
import NotFoundSection from "../components/NotFoundSection"

const BlogPage = ({ pageType }) => {
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [loader, setLoader] = useState(true);
  const [mainEntityName, setMainEntityName] = useState(null);
  const [seoTitle, setSEOTitle] = useState(null);
  const [blogPosts, setBlogPosts] = useState([]);
  const { slug } = useParams();

  const menuItems = useMenuItems();
  const categories = useCategories();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuery = urlParams.get("q");

    const loadData = async () => {
      if (pageType === "search") {
        // search posts by query
        try {
          const posts = await butterCMS.post.search(urlQuery)
          setBlogPosts(posts.data.data)
        } catch (error) {
          setError(true)
        }
        setSEOTitle(`search results for ${urlQuery}`)
      } else {
        let filterBy = {}
        let entityName;

        try {
          if (pageType === "category") {
            // if category detail, filter posts by category and load detail
            filterBy = { category_slug: slug }
            entityName = (await butterCMS.category.retrieve(slug)).data.data.name
            setMainEntityName(entityName)
            setSEOTitle(`${pageType}: ${entityName}`)
          } else if (pageType === "tag") {
            // if tag detail, filter posts by tag and load detail
            filterBy = { tag_slug: slug }
            entityName = (await butterCMS.tag.retrieve(slug)).data.data.name
            setMainEntityName(entityName)
            setSEOTitle(`${pageType}: ${entityName}`)
          } else {
            setSEOTitle(`all posts`)
          }

          // load all or filtered posts
          const posts = await butterCMS.post.list(filterBy)
          setBlogPosts(posts.data.data)
        } catch (error) {
          setError(true)
        }
      }

      setLoader(false);
    }

    loadData()

    setQuery(urlQuery);
  }, [pageType, slug]);

  if (error) return (<NotFoundSection />)
  if (loader) return (<Spinner />)

  return (
    <Layout menuItems={menuItems}>
      <SEO title={`Sample Blog - ${seoTitle}`} description={`Sample blog powered by ButterCMS, showing ${seoTitle}`} />

      <BlogPostsSection type={pageType} text={mainEntityName || query} />
      <BlogPostsList blogPosts={blogPosts} categories={categories} />
    </Layout>
  )
}

export default BlogPage
