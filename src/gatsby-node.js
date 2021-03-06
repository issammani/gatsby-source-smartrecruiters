const crypto = require('crypto')
const axios = require('axios')
import { JobPostNode, DepartmentNode } from './nodes'

/**
 * Return all open jobs for a given department
 * @param companyIdentifier string.
 * @param departmentId string.
 * @param fetchDetails boolean.
 */
async function getJobsForDepartment(companyIdentifier, departmentId, fetchDetails) {
  return getJobPosts(companyIdentifier, {
    department: departmentId
  }, fetchDetails)
}

/**
 * Return all job posts
 * @param companyIdentifier string.
 * @param queryParams object, defaults to only live job posts
 * @param fetchDetails boolean.
 */
async function getJobPosts(companyIdentifier, queryParams = {}, fetchDetails) {
  let jobs = await axios.get(`https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings`, {
      params: queryParams
    })

  if(fetchDetails) {
    jobs.data.content = (await Promise.all(jobs.data.content.map(job => {
      return axios.get(job.ref)
    }))).map(res => {
      return res.data
    })
  }

  return jobs
}

/**
 * Gets all departments for a given organization
 * @param companyIdentifier string.
 */
async function getDepartments(companyIdentifier) {
  return axios.get(`https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/departments`)
}

/**
 * Gatsby requires ID to be a string to define nodes and greenhouse.io uses an integer instead.
 *
 * @param obj object.
 * @returns object.
 */
const changeId = obj => {
  const updatedObj = obj
  updatedObj.id = updatedObj.id.toString()
  return updatedObj
}

exports.sourceNodes = async ({ actions }, { companyIdentifier, pluginOptions, fetchDetails}) => {
  const { createNode } = actions
  const options = pluginOptions || {}

  console.log(`Starting to fetch data from Smart Recruiters`)

  let departments, jobPosts
  try {
    departments = await getDepartments(companyIdentifier).then(response => response.data.content)
    jobPosts = await getJobPosts(companyIdentifier, options.jobPosts, fetchDetails).then(response => response.data.content)
  } catch (e) {
    console.log(`Failed to fetch data from Smart Recruiters`)
    process.exit(1)
  }

  console.log(`jobPosts fetched`, jobPosts.length)
  console.log(`departments fetched`, departments.length)
  return Promise.all(
    departments.map(async department => {
      const convertedDepartment = changeId(department)

      let jobs
      try {
        const jobsForDepartmentResults = await getJobsForDepartment(companyIdentifier, convertedDepartment.id, fetchDetails)
        jobs = jobsForDepartmentResults.data.content.map(job => changeId(job))
      } catch (e) {
        console.log(`Failed to fetch jobs for department.`)
        process.exit(1)
      }

      var jobPostsMapping = jobPosts.reduce((map, jobPost) => { 
        map[jobPost.id] = jobPost
        return map
      }, {})

      var jobPostsForDepartment = jobs.reduce((arr, job) => {
        const mappedJobPost = jobPostsMapping[job.id]
        if (mappedJobPost) {
          arr.push(mappedJobPost)
        }
        return arr
      }, [])

      convertedDepartment.jobPosts =  jobPostsForDepartment
      const departmentNode = DepartmentNode(changeId(convertedDepartment))

      jobPostsForDepartment.forEach(jobPost => {
        const convertedJobPost = changeId(jobPost)
        const jobPostNode = JobPostNode(convertedJobPost, { 
          parent: departmentNode.id 
        })
        createNode(jobPostNode)
      })

      createNode(departmentNode)
    })
  )
}

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;

  createTypes(`
    type SmartRecruitersJobPost implements Node {
      id: ID!
      uuid: String
      name: String
      refNumber: String
      releasedDate: Date
      ref: String
      creator: SmartRecruitersEmployee
      company: SmartRecruitersCompany
      industry: SmartRecruitersIndustry
      department: SmartRecruitersDepartment
      function: SmartRecruitersFunction
      experienceLevel: SmartRecruitersExperienceLevel
      typeOfEmployment: SmartRecruitersTypeOfEmployment
      location: SmartRecruitersLocation
      slug: String
      applyUrl: String
      jobAd: SmartRecruitersJobAd
    }

    type SmartRecruitersEmployee implements Node {
      name: String
      avatarUrl: String
    }

    type SmartRecruitersCompany implements Node {
      id: ID!
      name: String
    }

    type SmartRecruitersIndustry implements Node {
      id: ID!
      label: String
    }

    type SmartRecruitersDepartment implements Node {
      id: ID!
      label: String
      description: String
    }

    type SmartRecruitersFunction implements Node {
      id: ID!
      label: String
    }

    type SmartRecruitersExperienceLevel implements Node {
      id: ID!
      label: String
    }

    type SmartRecruitersTypeOfEmployment implements Node {
      label: String
    }

    type SmartRecruitersLocation implements Node {
      id: ID!
      country: String
      region: String
      city: String
      remote: Boolean
      address: String
      postalCode: String
    }

    type SmartRecruitersJobAd implements Node {
      sections: SmartRecruitersJobAdSections
    }

    type SmartRecruitersJobAdSections implements Node {
      companyDescription: SmartRecruitersJobAdSection
      jobDescription: SmartRecruitersJobAdSection
      qualifications: SmartRecruitersJobAdSection
      additionalInformation: SmartRecruitersJobAdSection
      videos: SmartRecruitersJobAdVideos
    }

    type SmartRecruitersJobAdSection implements Node {
      title: String
      text: String
    }

    type SmartRecruitersJobAdVideos implements Node {
      title: String
      urls: [String]
    }
  `)
}

// vim: set sw=2 ts=2 :
