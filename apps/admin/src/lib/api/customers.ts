import type { Customer, ListQuery, Paginated } from "@/types";
import { apiRequest } from "./client";

export const INITIAL_MOCK_CUSTOMERS: Customer[] = [
  {
    id: "cust_01",
    name: "Ananya Nair",
    email: "ananya@kitewire.io",
    phone: "+91 98470 12001",
    companyName: "Kitewire Technologies",
    gstNumber: "32AACCK4821P1ZQ",
    address: "7th Floor, Technopark Phase 1, Thiruvananthapuram, Kerala 695581",
    createdAt: "2025-02-11T09:20:00.000Z",
  },
  {
    id: "cust_02",
    name: "Rohan Kapoor",
    email: "rohan@northstarretail.in",
    phone: "+91 98110 88342",
    companyName: "Northstar Retail",
    gstNumber: "07AAECN9124R1Z8",
    address: "Plot 22, Okhla Industrial Estate, New Delhi 110020",
    createdAt: "2025-03-02T11:05:00.000Z",
  },
  {
    id: "cust_03",
    name: "Meera Iyer",
    email: "meera@bluepeak.co",
    phone: "+91 99001 44521",
    companyName: "Bluepeak Analytics",
    gstNumber: "29AAGCB2231M1ZT",
    address: "Indiranagar 2nd Stage, Bengaluru, Karnataka 560038",
    createdAt: "2025-03-19T08:45:00.000Z",
  },
  {
    id: "cust_04",
    name: "Arjun Sethi",
    email: "arjun@helixlogistics.com",
    phone: "+91 98202 77810",
    companyName: "Helix Logistics",
    gstNumber: "27AAACH3987L1ZK",
    address: "Bandra Kurla Complex, Mumbai, Maharashtra 400051",
    createdAt: "2025-04-05T14:30:00.000Z",
  },
  {
    id: "cust_05",
    name: "Kavya Menon",
    email: "kavya@lumenhealth.in",
    phone: "+91 97460 55802",
    companyName: "Lumen Health",
    gstNumber: "32AABCL6174H1ZP",
    address: "Kochi Infopark Campus, Kakkanad, Kerala 682042",
    createdAt: "2025-04-27T10:10:00.000Z",
  },
  {
    id: "cust_06",
    name: "Vikram Rao",
    email: "vikram@vertexmfg.com",
    phone: "+91 94488 93114",
    companyName: "Vertex Manufacturing",
    gstNumber: "33AACCV8290M1Z4",
    address: "Ambattur Industrial Estate, Chennai, Tamil Nadu 600058",
    createdAt: "2025-05-08T16:20:00.000Z",
  },
  {
    id: "cust_07",
    name: "Priya Desai",
    email: "priya@cobaltfinance.in",
    phone: "+91 99205 61278",
    companyName: "Cobalt Finance",
    gstNumber: "24AADCC5123F1ZJ",
    address: "Prahladnagar, Ahmedabad, Gujarat 380015",
    createdAt: "2025-05-21T12:00:00.000Z",
  },
  {
    id: "cust_08",
    name: "Aditya Verma",
    email: "aditya@orbitedu.org",
    phone: "+91 98180 30267",
    companyName: "Orbit Education",
    gstNumber: "06AAECO4419E1ZN",
    address: "Sector 44, Gurugram, Haryana 122003",
    createdAt: "2025-06-04T09:35:00.000Z",
  },
  {
    id: "cust_09",
    name: "Sneha Pillai",
    email: "sneha@maplehospitality.com",
    phone: "+91 98450 71903",
    companyName: "Maple Hospitality",
    gstNumber: "29AAHCM7726H1ZR",
    address: "Koramangala 5th Block, Bengaluru, Karnataka 560095",
    createdAt: "2025-06-18T13:15:00.000Z",
  },
  {
    id: "cust_10",
    name: "Rahul Joshi",
    email: "rahul@zenithmedia.in",
    phone: "+91 98700 24651",
    companyName: "Zenith Media",
    gstNumber: "09AAACZ1180M1Z6",
    address: "Sector 18, Noida, Uttar Pradesh 201301",
    createdAt: "2025-07-01T10:45:00.000Z",
  },
  {
    id: "cust_11",
    name: "Divya Krishnan",
    email: "divya@coastalfoods.co",
    phone: "+91 98952 40318",
    companyName: "Coastal Foods",
    gstNumber: "32AACCC9042F1Z2",
    address: "Marine Drive, Kochi, Kerala 682031",
    createdAt: "2025-07-14T15:25:00.000Z",
  },
  {
    id: "cust_12",
    name: "Karthik Subramanian",
    email: "karthik@ampereenergy.in",
    phone: "+91 95000 88124",
    companyName: "Ampere Energy",
    gstNumber: "33AAACA6715E1ZY",
    address: "Guindy, Chennai, Tamil Nadu 600032",
    createdAt: "2025-07-29T08:05:00.000Z",
  },
  {
    id: "cust_13",
    name: "Nisha Gupta",
    email: "nisha@pinnaclelegal.in",
    phone: "+91 98390 51276",
    companyName: "Pinnacle Legal",
    gstNumber: "19AADCP3320L1Z9",
    address: "Park Street, Kolkata, West Bengal 700016",
    createdAt: "2025-08-06T11:40:00.000Z",
  },
  {
    id: "cust_14",
    name: "Sameer Ali",
    email: "sameer@halomobility.com",
    phone: "+91 99490 76321",
    companyName: "Halo Mobility",
    gstNumber: "36AAHCH2298M1ZQ",
    address: "HITEC City, Hyderabad, Telangana 500081",
    createdAt: "2025-08-17T14:55:00.000Z",
  },
  {
    id: "cust_15",
    name: "Tara Thomas",
    email: "tara@westbridgerealty.in",
    phone: "+91 98470 63289",
    companyName: "Westbridge Realty",
    gstNumber: "32AAACW8710R1ZB",
    address: "Vyttila, Kochi, Kerala 682019",
    createdAt: "2025-08-28T09:10:00.000Z",
  },
  {
    id: "cust_16",
    name: "Gaurav Malhotra",
    email: "gaurav@ironcladsec.com",
    phone: "+91 98105 39764",
    companyName: "Ironclad Security",
    gstNumber: "07AAECI5093S1ZU",
    address: "Cyber City, DLF Phase 3, Gurugram, Haryana 122002",
    createdAt: "2025-09-04T12:35:00.000Z",
  },
  {
    id: "cust_17",
    name: "Aishwarya Bose",
    email: "aishwarya@novabiotech.in",
    phone: "+91 98302 91547",
    companyName: "Nova Biotech",
    gstNumber: "19AABCN7841B1ZP",
    address: "Salt Lake Sector V, Kolkata, West Bengal 700091",
    createdAt: "2025-09-15T10:25:00.000Z",
  },
  {
    id: "cust_18",
    name: "Manav Shah",
    email: "manav@quantasystems.io",
    phone: "+91 99041 20875",
    companyName: "Quanta Systems",
    gstNumber: "24AAACQ6604S1ZM",
    address: "GIFT City, Gandhinagar, Gujarat 382355",
    createdAt: "2025-09-26T16:50:00.000Z",
  },
  {
    id: "cust_19",
    name: "Lakshmi Raman",
    email: "lakshmi@greenfieldagri.com",
    phone: "+91 94430 57219",
    companyName: "Greenfield Agritech",
    gstNumber: "33AAGCG1187A1Z3",
    address: "T Nagar, Chennai, Tamil Nadu 600017",
    createdAt: "2025-10-02T08:15:00.000Z",
  },
  {
    id: "cust_20",
    name: "Nikhil Bhat",
    email: "nikhil@summittravel.in",
    phone: "+91 98450 41903",
    companyName: "Summit Travel",
    gstNumber: "29AAHCS3429T1Z8",
    address: "MG Road, Bengaluru, Karnataka 560001",
    createdAt: "2025-10-09T13:45:00.000Z",
  },
  {
    id: "cust_21",
    name: "Riya Choudhary",
    email: "riya@beaconinsurance.co",
    phone: "+91 98710 65831",
    companyName: "Beacon Insurance",
    gstNumber: "09AAACB2296I1ZR",
    address: "Sector 62, Noida, Uttar Pradesh 201309",
    createdAt: "2025-10-16T11:20:00.000Z",
  },
  {
    id: "cust_22",
    name: "Harish Kumar",
    email: "harish@meridiantextiles.com",
    phone: "+91 94420 38105",
    companyName: "Meridian Textiles",
    gstNumber: "33AACCM9018T1ZF",
    address: "Tiruppur, Tamil Nadu 641604",
    createdAt: "2025-10-23T09:55:00.000Z",
  },
  {
    id: "cust_23",
    name: "Pooja Reddy",
    email: "pooja@circlepayments.in",
    phone: "+91 99490 22761",
    companyName: "Circle Payments",
    gstNumber: "36AAACC7712P1ZW",
    address: "Gachibowli, Hyderabad, Telangana 500032",
    createdAt: "2025-10-29T15:05:00.000Z",
  },
  {
    id: "cust_24",
    name: "Siddharth Jain",
    email: "siddharth@lunarstudios.co",
    phone: "+91 98202 71430",
    companyName: "Lunar Studios",
    gstNumber: "27AAACL5573S1ZY",
    address: "Lower Parel, Mumbai, Maharashtra 400013",
    createdAt: "2025-11-03T10:30:00.000Z",
  },
];

const STORAGE_KEY = "subloop_customers_store";

export function getStoredCustomers(): Customer[] {
  if (typeof window === "undefined") return INITIAL_MOCK_CUSTOMERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK_CUSTOMERS));
      return INITIAL_MOCK_CUSTOMERS;
    }
    return JSON.parse(raw) as Customer[];
  } catch {
    return INITIAL_MOCK_CUSTOMERS;
  }
}

function saveCustomers(customers: Customer[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
  } catch {
    // Ignore storage issues
  }
}

export async function getCustomers(
  params?: ListQuery,
): Promise<Paginated<Customer>> {
  return apiRequest<Paginated<Customer>>("/customers", {
    params,
    mock: () => {
      let list = [...getStoredCustomers()];

      if (params?.search) {
        const query = params.search.toLowerCase().trim();
        list = list.filter(
          (customer) =>
            customer.name.toLowerCase().includes(query) ||
            customer.email.toLowerCase().includes(query) ||
            customer.companyName?.toLowerCase().includes(query),
        );
      }

      if (params?.sortBy) {
        const key = params.sortBy as keyof Customer;
        const order = params.sortOrder === "desc" ? -1 : 1;
        list.sort((a, b) => {
          const valueA = String(a[key] ?? "");
          const valueB = String(b[key] ?? "");
          return valueA.localeCompare(valueB) * order;
        });
      }

      const total = list.length;
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 10;
      const start = (page - 1) * pageSize;

      return {
        items: list.slice(start, start + pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      };
    },
  });
}

export async function getAllCustomers(): Promise<Customer[]> {
  return apiRequest<Customer[]>("/customers/all", {
    mock: () => getStoredCustomers(),
  });
}

export async function getCustomerById(
  id: string,
): Promise<Customer | undefined> {
  return apiRequest<Customer | undefined>(`/customers/${id}`, {
    mock: () => getStoredCustomers().find((customer) => customer.id === id),
  });
}

export async function createCustomer(
  data: Omit<Customer, "id" | "createdAt">,
): Promise<Customer> {
  return apiRequest<Customer>("/customers", {
    method: "POST",
    body: data,
    mock: () => {
      const list = getStoredCustomers();
      const customer: Customer = {
        ...data,
        id: `cust_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      saveCustomers([customer, ...list]);
      return customer;
    },
  });
}
