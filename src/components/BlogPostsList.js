import React from "react"
import { Link } from 'react-router-dom';
import BlogWidget from "./BlogWidget"
import ZeroData from "./ZeroData"
import placeholder from "../assets/images/placeholder.png"

const BlogPostsList = ({ blogPosts, categories }) => {

  return (
    <section className="blog-posts">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8 blog-roll-cards">
            <div className="row">{/* <!--nested row for blogroll--> */}

              {blogPosts.length === 0 && <ZeroData />}

              {blogPosts.map(post => {
                return (<div key={post.slug} className="col-12 col-lg-6">
                  <div className="blog-roll-card">
                    <div className="blog-roll-card-meta">
                      <h2 className="blog-roll-card-header"><Link to={`/blog/${post.slug}`}>{post.title}</Link></h2>
                      <ul className="blog-roll-card-meta-info">
                        <li>
                          <a href="#"><img src={post.author.profile_image || placeholder} alt="#" />{post.author.first_name} {post.author.last_name}</a>
                        </li>
                        <li>
                          <a href="#"><i className="lni lni-calendar"></i> {new Date(post.published).toLocaleString()}</a>
                        </li>
                        <li>
                          {post.tags.map(tag => {
                            return <Link key={tag.slug} to={`/blog/tag/${tag.slug}`}><i className="lni lni-tag"></i> {tag.name} </Link>
                          })}
                        </li>
                      </ul>
                    </div>
                    {post.featured_image && <div className="single-post-thumbnail">
                      <img src={post.featured_image} alt={post.featured_image_alt} />
                    </div>
                    }
                    <div className="blog-roll-card-body">
                      <p>{post.summary}</p>
                    </div>
                    <div className="blog-roll-card-footer text-center">
                      <Link to={`/blog/${post.slug}`} className="main-btn btn-hover">Read More</Link>
                    </div>
                  </div>
                </div>)
              })}

            </div>
          </div>

          {/* <!-- Widgets Column --> */}
          <aside className="col-12 col-lg-4">
            <BlogWidget categories={categories} />
          </aside>
        </div>
      </div>
    </section>
  )
}

export default BlogPostsList;
