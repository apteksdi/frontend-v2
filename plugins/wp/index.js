'use strict'

const moment = require('moment')
const i18n = require('i18n')

const cms = require('./cms')
const config = require('../../config')
const utils = require('../../utils')


module.exports = function (app) {
  app.set('cms', cms)
  const Model = new cms.CmsModel()
  const blogPath = config.get('WP_BLOG_PATH')

  app.use((req, res, next) => {
    // Set moment's locale
    moment.locale(req.getLocale())
    next()
  })

  app.get('/', async (req, res,next) => {
    // Get latest 3 blog posts and pass it to home template
    let posts = await Model.getListOfPosts({
      number: 1,
      fields: 'slug,title,content,date,modified,featured_image,categories,attachments'
    })
    posts = posts.map(post => {
      const postAttachments = post.attachments ? Object.values(post.attachments) : []
      const featuredImageAttachment = Object
        .values(postAttachments)
        .find(attachment => attachment.URL === post.featured_image) || {}

      return {
        slug: post.slug,
        title: post.title,
        content: post.content,
        published: moment(post.date).format('Do MMMM YYYY'),
        modified: moment(post.modified).format('Do MMMM YYYY'),
        image: post.featured_image,
        categories: post.categories ? Object.keys(post.categories) : [],
        imageCaption: featuredImageAttachment.caption,
        imageAlt: featuredImageAttachment.alt
      }
    })
    res.locals.posts = posts
    next()
  })

  app.get(blogPath, listStaticPages);
  app.get(`${blogPath}/news/:page`, showPostPage);
  app.get(['/news/:page', '/:parent/:page'], showStaticPage);

  async function listStaticPages(req, res, next) {
    const defaultQuery = {
      number: 100,
      page: 1,
      fields: 'slug,title,content,date,modified,featured_image,categories,attachments'
    }
    const actualQuery = Object.assign(defaultQuery, req.query)
    const response = (await Model.getListOfPostsWithMeta(actualQuery))

    const currentPage = parseInt(actualQuery.page, 3)
    res.locals.found = response.found
    res.locals.currentPage = currentPage
    const totalPages = Math.ceil(response.found / actualQuery.number)
    res.locals.totalPages = totalPages
    res.locals.pages = utils.pagination(currentPage, totalPages)
    res.locals.originalUrl = req.originalUrl

    res.locals.posts = response.posts.map(post => {
      const postAttachments = post.attachments ? Object.values(post.attachments) : []
      const featuredImageAttachment = Object
        .values(postAttachments)
        .find(attachment => attachment.URL === post.featured_image) || {}

      return {
        slug: post.slug,
        title: post.title,
        content: post.content,
        published: moment(post.date).format('Do MMMM YYYY'),
        modified: moment(post.modified).format('Do MMMM YYYY'),
        image: post.featured_image,
        categories: post.categories ? Object.keys(post.categories) : [],
        imageCaption: featuredImageAttachment.caption,
        imageAlt: featuredImageAttachment.alt
      }
    })
    next()
  }

  async function showPostPage(req, res, next) {
    const slug = req.params.page
    try {
      const post = await Model.getPost({slug})
      const postAttachments = post.attachments ? Object.values(post.attachments) : []
      const featuredImageAttachment = Object
        .values(postAttachments)
        .find(attachment => attachment.URL === post.featured_image) || {}

      res.render('post.html', {
        slug: post.slug,
        title: post.title,
        content: post.content,
        published: moment(post.date).format('Do MMMM YYYY'),
        modified: moment(post.modified).format('Do MMMM YYYY'),
        image: post.featured_image,
        thisPageFullUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
        categories: post.categories ? Object.keys(post.categories) : [],
        imageCaption: featuredImageAttachment.caption,
        imageAlt: featuredImageAttachment.alt
      })
    } catch (err) {
      next(err)
    }
  }

  async function showStaticPage(req, res, next) {
    // Get the post using slug
    let slug = [req.params.parent, req.params.page].join('/')
    slug = slug.startsWith('/') ? slug.substr(1) : slug
    // Locale of request, eg, 'en'
    const locale = req.getLocale()
    // To handle content in multiple languages, we create a page per language
    // on WordPress with a suffix in a slug, e.g., if default locale is 'en':
    // locale is 'en' > use 'page' slug when reading from WP
    // locale is 'da' => use 'page-da' slug when reading from WP
    if (locale !== config.get('SITE_LOCALE') && i18n.getLocales().includes(locale)) {
      slug += `-${locale}`
    }
    try {
      const id = Number.isInteger(parseInt(req.params.page)) ? req.params.page : undefined
      const post = await Model.getPost({slug: req.params.page, id, parentSlug: req.params.parent})
      res.render('static.html', {
        slug: post.slug,
        parentSlug: req.params.parent,
        title: post.title,
        content: post.content,
        image: post.featured_image,
        thisPageFullUrl: req.protocol + '://' + req.get('host') + req.originalUrl
      })
    } catch (err) {
      if (err.statusCode === 404) {
        // Pass it to next router, eg, if `/page` doesn't exist in WP, it might
        // be a org name etc.
        next()
      } else {
        next(err)
      }
    }
  }
}
